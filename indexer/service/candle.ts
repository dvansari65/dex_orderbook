import { getBucketStart } from "../helper/getBucketStart";
import prisma from "../lib/prisma"
import { FillEvent } from "../types/events"
import { CandleSnapshot } from "../types/service";
import {formatTimeForResolution} from "../helper/formatTimeForReso"
// Define return type with volume
interface FillEventResult {
  candle: CandleSnapshot;
  volume: number;  // Current volume after this trade
  timestamp: string; // ISO string for time
}

export const handleFillEvent = async (
  event: FillEvent, 
  sign: string
): Promise<FillEventResult | undefined> => {
  const { timestamp, price, maker, taker, baseLotsFilled, side, marketPubkey } = event;
  
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

    const resolutions = ['1m', '5m', '1h', '1d'];
    let result: FillEventResult | undefined;

    for (const resolution of resolutions) {
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

      // Return only 1m candle for real-time updates
      if (resolution === '1m') {
        result = {
          candle: {
            high: Number(candle.high),
            low: Number(candle.low),
            open: Number(candle.open),
            close: Number(candle.close),
            time: formatTimeForResolution(candle.timestamp, resolution),
          },
          volume: newVolume,  // Current total volume for this time bucket
          timestamp: candle.timestamp.toISOString()
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Error handling fill event:", error);
    return undefined;
  }
}

export const snapshotOfCandle = async (
  resolution: string,
  marketPubKey: string
): Promise<{
  candles: CandleSnapshot[],
  volumeData: { time: string, value: number }[]
}> => {
  try {
    
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
        time: c.timestamp.toISOString().split("T")[0],
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      })),
      volumeData: candles.map(c => ({
        time: c.timestamp.toISOString().split("T")[0],
        value: Number(c.volume) / 1000  // Adjust divisor as needed
      }))
    };
  } catch (error) {
    console.error("Error fetching candle snapshot:", error);
    return { candles: [], volumeData: [] };
  }
}