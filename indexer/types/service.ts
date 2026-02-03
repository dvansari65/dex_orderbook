import prisma from "@/lib/prisma";

export type HandleFillEventResponse = Awaited<ReturnType<typeof prisma.candle.create>>

export interface CandleSnapshot {
    open: number,
    close: number,
    high: number,
    low: number,
    time: number
}