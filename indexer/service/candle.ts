import { getBucketStart } from "../helper/getBucketStart";
import { FillEvent } from "../types/events"
import prisma from "../lib/prisma"
import { CandleSnapshot } from "../types/service";
import {formatTimeForResolution} from "../helper/formatTimeForReso"
import {updateOrdersOnFill} from "../helper/updateOrderOnFill"
import { isDatabaseConnectivityError } from "../lib/env";
import {
  getCandleSnapshotKey,
  getCandleSnapshotTtlSeconds,
  invalidateCandleSnapshots,
} from "../src/service/candleCache";
import { jsonCache } from "../src/cache/jsonCache";

const PRICE_DISPLAY_DIVISOR = 1_000;
const VOLUME_DISPLAY_DIVISOR = 1_000;
const RESOLUTIONS = ["1m", "5m", "1h", "1d"] as const;

// Define return type with volume
interface FillEventResult {
  candles: Partial<Record<(typeof RESOLUTIONS)[number], CandleSnapshot>>;
  volumes: Partial<Record<(typeof RESOLUTIONS)[number], number>>;
  timestamp: string; // ISO string for time
}

type CandleSnapshotResponse = {
  candles: CandleSnapshot[],
  volumeData: { time: string | number, value: number }[]
};

export const handleFillEvent = async (
  event: FillEvent, 
  sign: string
): Promise<FillEventResult | undefined> => {
  const { timestamp, price, maker,makerOrderId, taker,takerOrderId, baseLotsFilled, side, marketPubkey } = event
  // Validate required fields
  if (!timestamp || !price || !maker || !taker || !baseLotsFilled || !sign || !marketPubkey) {
    console.error("Missing required fields in fill event", { 
      timestamp, price, maker, taker, baseLotsFilled, sign, marketPubkey 
    });
    return undefined;
  }

  const sideStr = 'ask' in (side as any) ? 'ask' : 'bid';
  try {
    const timestampMs = timestamp.toNumber() * 1000;
    const tradeDate = new Date(timestampMs);
    const marketAddress = marketPubkey.toString();

    // Upsert trade - avoid duplicate signature errors
    await prisma.trade.upsert({
      where: { signature: sign },
      update: {},
      create: {
        signature: sign,
        price: price.toString(),
        timestamp: tradeDate,
        marketAddress: marketAddress,
        quantity: baseLotsFilled.toString(),
        side: sideStr
      }
    });
    // updating order
    await updateOrdersOnFill(makerOrderId,takerOrderId,baseLotsFilled?.toNumber())

    let result: FillEventResult | undefined;
    const candlesByResolution: FillEventResult["candles"] = {};
    const volumesByResolution: FillEventResult["volumes"] = {};

    for (const resolution of RESOLUTIONS) {
      const bucketStart = getBucketStart(tradeDate, resolution);
      
      const existingCandle = await prisma.candle.findUnique({
        where: {
          marketAddress_resolution_timestamp: {
            marketAddress: marketAddress,
            timestamp: bucketStart,
            resolution: resolution
          }
        }
      });

      const priceNum = price.toNumber();
      const volumeNum = baseLotsFilled.toNumber(); // This trade's volume
      console.log("base lots filled:",baseLotsFilled.toNumber())
      let candle;
      let newVolume: number;

      if (existingCandle) {
        const currentHigh = Number(existingCandle.high);
        const currentLow = Number(existingCandle.low);
        const currentVolume = Number(existingCandle.volume);
        
        // NEW VOLUME = existing volume + this trade's volume
        newVolume = currentVolume + volumeNum;

        candle = await prisma.candle.update({
          where: { id: existingCandle.id },
          data: {
            high: Math.max(priceNum, currentHigh),
            low: Math.min(priceNum, currentLow),
            close: priceNum,
            volume: newVolume  // Updated volume
          }
        });
      } else {
        // First trade in this time bucket
        newVolume = volumeNum; // Starting volume = this trade's volume
        
        candle = await prisma.candle.create({
          data: {
            marketAddress: marketAddress,
            resolution,
            timestamp: bucketStart,
            open: priceNum,
            high: priceNum,
            low: priceNum,
            close: priceNum,
            volume: newVolume
          }
        });
      }
      console.log("created candle:",candle)
      candlesByResolution[resolution] = {
        high: Number(candle.high) / PRICE_DISPLAY_DIVISOR,
        low: Number(candle.low) / PRICE_DISPLAY_DIVISOR,
        open: Number(candle.open) / PRICE_DISPLAY_DIVISOR,
        close: Number(candle.close) / PRICE_DISPLAY_DIVISOR,
        time: formatTimeForResolution(candle.timestamp, resolution),
      };
      volumesByResolution[resolution] = newVolume / VOLUME_DISPLAY_DIVISOR;
    }

    result = {
      candles: candlesByResolution,
      volumes: volumesByResolution,
      timestamp: tradeDate.toISOString(),
    };

    await invalidateCandleSnapshots(marketAddress);

    return result;
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      const prismaError = error as { code?: string; message?: string };
      console.error(`Database unavailable while handling fill event (${prismaError.code}): ${prismaError.message}`);
      return undefined;
    }
    console.error("Error handling fill event:", error);
    return undefined;
  }
}

const fetchCandleSnapshotFromDatabase = async (
  resolution: string,
  marketPubKey: string
): Promise<CandleSnapshotResponse> => {
  try {
    if( typeof marketPubKey !== "string" || !marketPubKey || !resolution){
      console.error("Market key not provided!");
      return {
        candles:[],
        volumeData:[]
      }
    }
    const candles = await prisma.candle.findMany({
      where: { 
        marketAddress: marketPubKey, 
        resolution: resolution
      },
      orderBy: { timestamp: "asc" },
      take: 500
    });

    return {
      candles: candles.map(c => ({
        time: formatTimeForResolution(c.timestamp, resolution),
        open: Number(c.open) / PRICE_DISPLAY_DIVISOR,
        high: Number(c.high) / PRICE_DISPLAY_DIVISOR,
        low: Number(c.low) / PRICE_DISPLAY_DIVISOR,
        close: Number(c.close) / PRICE_DISPLAY_DIVISOR,
      })),
      volumeData: candles.map(c => ({
        time: formatTimeForResolution(c.timestamp, resolution),
        value: Number(c.volume) / VOLUME_DISPLAY_DIVISOR
      }))
    };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      const prismaError = error as { code?: string; message?: string };
      console.error(`Database unavailable while fetching candle snapshot (${prismaError.code}): ${prismaError.message}`);
      return { candles: [], volumeData: [] };
    }
    console.error("Error fetching candle snapshot:", error);
    return { candles: [], volumeData: [] };
  }
}

export const snapshotOfCandle = async (
  resolution: string,
  marketPubKey: string
): Promise<CandleSnapshotResponse> =>
  jsonCache.getOrLoad(
    getCandleSnapshotKey(marketPubKey, resolution),
    getCandleSnapshotTtlSeconds(),
    () => fetchCandleSnapshotFromDatabase(resolution, marketPubKey)
  );
