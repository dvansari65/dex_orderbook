import { OrderStatus } from "../generated/prisma/enums";
import prisma from "../lib/prisma";
import { OrderPlacedEventData, Side } from "../types/events";

const QUOTE_LOT_SIZE  = 1_000
const BASE_LOT_SIZE   = 1_000
const QUOTE_DECIMALS  = 1_000_000   // 10^6
const BASE_DECIMALS   = 1_000_000   // 10^6

export const getOrderHistory = async (userPublicKey: string | null, marketKey: string) => {
  try {
    if (!userPublicKey || !marketKey) {
      console.error("Missing userPublicKey or marketKey")
      return []
    }
    
    const orders = await prisma.order.findMany({
      where: {
        marketAddress: marketKey,
        ownerAddress:  userPublicKey,
      },
      select: {
        orderId:     true,
        side:        true,
        price:       true,
        baseLots:    true,
        filledLots:  true,
        status:      true,
        placedAt:    true,
        cancelledAt: true,
      },
      orderBy: { placedAt: "desc" },
      take: 20,
    })

    // Convert lots → human readable in one pass
    return orders.map(o => ({
      orderId:     o.orderId,
      side:        o.side,
      price:       (o.price * QUOTE_LOT_SIZE) / QUOTE_DECIMALS,       // quote lots → USDC
      quantity:    (o.baseLots * BASE_LOT_SIZE) / BASE_DECIMALS,       // base lots → tokens
      filled:      (o.filledLots * BASE_LOT_SIZE) / BASE_DECIMALS,     // base lots → tokens
      status:      o.status,
      placedAt:    o.placedAt,
      cancelledAt: o.cancelledAt,
    }))

  } catch (error) {
    console.error("getOrderHistory error:", error)
    throw error
  }
}

export const createOrder = async (
    data: OrderPlacedEventData
): Promise<void> => {
    const {
        market,
        owner,
        orderId,
        clientOrderId,
        side,
        price,
        baseLots,
        timestamp,
    } = data;

    if (!market || !owner || !orderId || !price || !baseLots || !timestamp) {
        console.error("createOrder: missing required fields", data);
        return;
    }
    // ✅ Same pattern as your convertEvent
    const sideStr = side && "bid" in side ? Side.Bid : Side.Ask;
    const placedAt = new Date(timestamp.toNumber() * 1000);
    try {
        await prisma.order.upsert({
            where: { orderId: orderId.toString() },
            update: {},
            create: {
                orderId: orderId.toString(),
                clientOrderId: clientOrderId.toString(),
                marketAddress: market.toString(),
                ownerAddress: owner.toString(),
                side: sideStr,
                price: price.toNumber(), // storing price in quote lots to avoid decimals 
                baseLots: baseLots.toNumber(), // storing number or token in base lots for decimal precision
                filledLots: 0,
                status: OrderStatus.Open,
                placedAt,
            },
        });
    } catch (error) {
        console.error("createOrder: failed to insert order", error);
        throw error;
    }
};