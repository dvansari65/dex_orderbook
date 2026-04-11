"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "@/providers/SocketProvider";
import OrderBookRow from "@/components/market/initial-snapshot";


interface PriceLevel {
  orderId: number;
  price: number;
  quantity: number;
  total: number;
}

interface Order {
  orderId: number;
  price: number;
  quantity: number;
  side: "bid" | "ask";
  timestamp?: number;
}

interface OrderBookState {
  asks: Map<number, PriceLevel>;
  bids: Map<number, PriceLevel>;
}

type TxEvent =
  | {
      type: "orderPlacedEvent";
      data: { id: number; p: number; q: number; s: "bid" | "ask"; ts?: number };
    }
  | {
      type: "orderFillEvent";
      data: {
        makerOrderId: number;
        takerOrderId: number;
        price: number;
        baseLotsFilled: number;
        baseLotsRemaining: number;
        timestamp?: number;
        side: "bid" | "ask";
      };
    }
  | {
      type: "OrderCancelledEvent";
      data: { id: number; p: number; q: number; s: "bid" | "ask"; ts?: number };
    };

const MemoizedRow = memo(OrderBookRow);

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSide = (value: unknown): "bid" | "ask" => {
  return value === "ask" ? "ask" : "bid";
};

const getBookSide = (book: OrderBookState, side: "bid" | "ask") =>
  side === "ask" ? book.asks : book.bids;

export default function Orderbook() {
  const socket = useSocket();
  const [displayData, setDisplayData] = useState<OrderBookState>({
    asks: new Map(),
    bids: new Map(),
  });

  const bookRef = useRef<OrderBookState>({ asks: new Map(), bids: new Map() });
  const ordersRef = useRef<Map<number, Order>>(new Map());
  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerUpdate = () => {
    if (batchTimer.current) return;

    batchTimer.current = setTimeout(() => {
      setDisplayData({
        asks: new Map(bookRef.current.asks),
        bids: new Map(bookRef.current.bids),
      });
      batchTimer.current = null;
    }, 50);
  };

  const upsertPriceLevel = (
    side: "bid" | "ask",
    price: number,
    deltaQty: number,
    orderId: number
  ) => {
    const targetMap = getBookSide(bookRef.current, side);
    const current = targetMap.get(price);
    const nextQty = (current?.quantity ?? 0) + deltaQty;

    if (nextQty <= 0) {
      targetMap.delete(price);
      return;
    }

    targetMap.set(price, {
      orderId: current?.orderId ?? orderId,
      price,
      quantity: nextQty,
      total: price * nextQty,
    });
  };

  const removeOrderFromBook = (order: Order, quantityToRemove: number) => {
    upsertPriceLevel(order.side, order.price, -quantityToRemove, order.orderId);
  };

  const applyMakerFill = (fill: Extract<TxEvent, { type: "orderFillEvent" }>["data"]) => {
    const makerOrderId = toNumber(fill.makerOrderId);
    const fillQty = toNumber(fill.baseLotsFilled);
    const makerRemaining = toNumber(fill.baseLotsRemaining);
    const executionPrice = toNumber(fill.price);
    const takerSide = toSide(fill.side);
    const makerSide = takerSide === "bid" ? "ask" : "bid";

    const makerOrder = ordersRef.current.get(makerOrderId);

    if (makerOrder) {
      removeOrderFromBook(makerOrder, fillQty);

      if (makerRemaining <= 0) {
        ordersRef.current.delete(makerOrderId);
      } else {
        ordersRef.current.set(makerOrderId, {
          ...makerOrder,
          quantity: makerRemaining,
          timestamp: toNumber(fill.timestamp),
        });
      }
      return;
    }

    upsertPriceLevel(makerSide, executionPrice, -fillQty, makerOrderId);
  };

  const applyPlacedOrder = (
    placed: Extract<TxEvent, { type: "orderPlacedEvent" }>["data"],
    alreadyFilledQty: number
  ) => {
    const orderId = toNumber(placed.id);
    const price = toNumber(placed.p);
    const originalQty = toNumber(placed.q);
    const side = toSide(placed.s);
    const remainingQty = Math.max(0, originalQty - alreadyFilledQty);

    if (remainingQty <= 0) {
      ordersRef.current.delete(orderId);
      return;
    }

    ordersRef.current.set(orderId, {
      orderId,
      price,
      quantity: remainingQty,
      side,
      timestamp: toNumber(placed.ts),
    });

    upsertPriceLevel(side, price, remainingQty, orderId);
  };

  const applyCancelledOrder = (cancelled: Extract<TxEvent, { type: "OrderCancelledEvent" }>["data"]) => {
    const orderId = toNumber(cancelled.id);
    const existingOrder = ordersRef.current.get(orderId);

    if (existingOrder) {
      removeOrderFromBook(existingOrder, existingOrder.quantity);
      ordersRef.current.delete(orderId);
      return;
    }

    upsertPriceLevel(
      toSide(cancelled.s),
      toNumber(cancelled.p),
      -toNumber(cancelled.q),
      orderId
    );
  };

  useEffect(() => {
    if (!socket) return;

    const handleSnapshot = (payload: any) => {
      const asks = new Map<number, PriceLevel>();
      const bids = new Map<number, PriceLevel>();
      const orders = new Map<number, Order>();

      payload?.orderbook?.asks?.forEach((node: any) => {
        const orderId = toNumber(node.orderId ?? node.id);
        const price = toNumber(node.price);
        const quantity = toNumber(node.quantity);
        const current = asks.get(price);

        asks.set(price, {
          orderId: current?.orderId ?? orderId,
          price,
          quantity: (current?.quantity ?? 0) + quantity,
          total: price * ((current?.quantity ?? 0) + quantity),
        });

        orders.set(orderId, {
          orderId,
          price,
          quantity,
          timestamp: toNumber(node.ts ?? node.timestamp),
          side: "ask",
        });
      });

      payload?.orderbook?.bids?.forEach((node: any) => {
        const orderId = toNumber(node.orderId ?? node.id);
        const price = toNumber(node.price);
        const quantity = toNumber(node.quantity);
        const current = bids.get(price);

        bids.set(price, {
          orderId: current?.orderId ?? orderId,
          price,
          quantity: (current?.quantity ?? 0) + quantity,
          total: price * ((current?.quantity ?? 0) + quantity),
        });

        orders.set(orderId, {
          orderId,
          price,
          quantity,
          timestamp: toNumber(node.ts ?? node.timestamp),
          side: "bid",
        });
      });

      bookRef.current = { asks, bids };
      ordersRef.current = orders;
      triggerUpdate();
    };

    const handleTxEvents = (events: TxEvent[]) => {
      if (!Array.isArray(events) || events.length === 0) return;

      const takerFilledByOrderId = new Map<number, number>();

      for (const event of events) {
        if (event.type !== "orderFillEvent") continue;

        const takerOrderId = toNumber(event.data.takerOrderId);
        const fillQty = toNumber(event.data.baseLotsFilled);
        takerFilledByOrderId.set(
          takerOrderId,
          (takerFilledByOrderId.get(takerOrderId) ?? 0) + fillQty
        );
      }

      for (const event of events) {
        if (event.type === "orderFillEvent") {
          applyMakerFill(event.data);
        }
      }

      for (const event of events) {
        if (event.type === "orderPlacedEvent") {
          applyPlacedOrder(
            event.data,
            takerFilledByOrderId.get(toNumber(event.data.id)) ?? 0
          );
        }
      }

      for (const event of events) {
        if (event.type === "OrderCancelledEvent") {
          applyCancelledOrder(event.data);
        }
      }

      triggerUpdate();
    };

    socket.on("snapshot", handleSnapshot);
    socket.on("tx:events", handleTxEvents);

    return () => {
      socket.off("snapshot", handleSnapshot);
      socket.off("tx:events", handleTxEvents);
      if (batchTimer.current) clearTimeout(batchTimer.current);
    };
  }, [socket]);

  const sortedAsks = useMemo(() => {
    return Array.from(displayData.asks.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 20)
      .reverse();
  }, [displayData.asks]);

  const sortedBids = useMemo(() => {
    return Array.from(displayData.bids.values())
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);
  }, [displayData.bids]);

  const spread = useMemo(() => {
    const bestAsk = Math.min(...Array.from(displayData.asks.keys()));
    const bestBid = Math.max(...Array.from(displayData.bids.keys()));
    return bestAsk !== Infinity && bestBid !== -Infinity
      ? (bestAsk - bestBid).toFixed(4)
      : "—";
  }, [displayData.asks, displayData.bids]);

  return (
    <div className="w-full h-full rounded-2xl bg-[#FAF8F6] flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--phoenix-text-primary)]">
        Order Book
      </div>

      {/* Column headers — tightened for smaller width */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[9px] font-medium text-[var(--phoenix-text-subtle)]">
        <div>Price</div>
        <div className="text-right">SOL</div>
        <div className="text-right">USDC</div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {sortedAsks.map((level) => (
            <MemoizedRow key={level.price} {...level} side="ask" />
          ))}
        </div>

        <div className="px-3 py-1 bg-[var(--phoenix-bg-main)] text-[9px] text-[var(--phoenix-text-subtle)]">
          Spread: {spread}
        </div>

        <div className="flex-1 overflow-hidden">
          {sortedBids.map((level) => (
            <MemoizedRow key={level.price} {...level} side="bid" />
          ))}
        </div>
      </div>
    </div>
  );
}