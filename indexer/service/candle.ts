

import { getBucketStart } from "../helper/getBucketStart";
import prisma from "../lib/prisma"
import { FillEvent, OrderFillEvent, OrderPartialFillEvent } from "../types/events"
import { CandleSnapshot, HandleFillEventResponse } from "@/types/service";

export const handleFillEvent = async (event: FillEvent): Promise<CandleSnapshot | undefined> => {
    const { timestamp, price, maker, taker, baseLotsFilled, signature, side, marketPubkey } = event;

    console.log("side raw value:", side, "type:", typeof side);
    if (!timestamp || !price || !maker || !taker || !baseLotsFilled || !signature) {
        throw new Error("Fields are missing!")
    }
    if (!marketPubkey) {
        throw new Error("Market pub key not found!")
    }
    if (!baseLotsFilled) {
        throw new Error("Base lots not provided!")
    }
    try {
        const priceStr = price.toString();
        const quantityStr = baseLotsFilled.toString();
        const timestampMs = timestamp.toNumber() * 1000;
        await prisma.trade.create({
            data: {
                signature: signature,
                price: priceStr,
                timestamp: new Date(timestampMs),
                marketAddress: maker.toString(),
                quantity: quantityStr,
                side: side as string
            }
        })
        const resolutions = ['1m', '5m', '1h', '1d'];

        for (const resolution of resolutions) {
            const bucketStart = getBucketStart(new Date(timestamp.toNumber()), resolution);

            const existingCandle = await prisma.candle.findUnique({
                where: {
                    marketAddress_resolution_timestamp: {
                        marketAddress: marketPubkey.toString(),
                        timestamp: bucketStart,
                        resolution: resolution
                    }
                }
            })
            if (existingCandle) {
                const currentHigh = parseFloat(existingCandle.high.toString());
                const currentLow = parseFloat(existingCandle.low.toString());
                const currentVolume = parseFloat(existingCandle.volume.toString())
                const priceNum = price.toNumber()
                const updatedCandle = await prisma.candle.update({
                    where: {
                        id: existingCandle.id
                    },
                    data: {
                        high: priceNum > currentHigh ? priceNum : currentHigh,
                        low: priceNum < currentLow ? priceNum : currentLow,
                        close: priceNum,
                        volume: (currentVolume + baseLotsFilled?.toNumber()).toString()
                    }
                })
                console.log("updated candle:",updatedCandle)
                const payload:CandleSnapshot = {
                    high:updatedCandle.high?.toNumber(),
                    low:updatedCandle.low?.toNumber(),
                    open:updatedCandle?.open?.toNumber(),
                    close:updatedCandle?.close.toNumber(),
                    time:Number(updatedCandle?.timestamp)
                  }
                return payload;
            } else {
                const createdCandle = await prisma.candle.create({
                    data: {
                        marketAddress: marketPubkey?.toString(),
                        resolution,
                        timestamp: bucketStart,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: baseLotsFilled?.toNumber()
                    }
                })
                console.log("created candle:",createdCandle)
                const payload:CandleSnapshot = {
                    high:createdCandle.high?.toNumber(),
                    low:createdCandle.low?.toNumber(),
                    open:createdCandle?.open?.toNumber(),
                    close:createdCandle?.close.toNumber(),
                    time:Number(createdCandle?.timestamp)
                  }
                return payload;
            }
        }
    } catch (error) {
        console.error("error:", error)
        return
    }
}



export const snapshotOfCandle = async (
    resolution: string = "1d",
    marketPubKey: string
): Promise<CandleSnapshot[] | undefined[]> => {
    try {
        const candles = await prisma.candle.findMany({
            where: {
                marketAddress: marketPubKey,
                resolution
            },
            orderBy: {
                timestamp: "asc"
            },
            take: 500
        })
        return candles.map(c => ({
            time: Math.floor(c.timestamp.getTime() / 1000),
            open: parseFloat(c.open.toString()),
            high: parseFloat(c.high.toString()),
            low: parseFloat(c.low.toString()),
            close: parseFloat(c.close.toString()),
        }))
    } catch (error) {
        console.error("error:", error)
        return []
    }
}

