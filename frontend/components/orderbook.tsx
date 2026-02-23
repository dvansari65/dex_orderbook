"use client";

import { useEffect, useMemo, useState, useRef, memo } from "react";
import { useSocket } from "@/providers/SocketProvider";
import OrderBookRow from "./market/initial-snapshot";
import { OrderFillEventData } from "@/types/events";
import OrderbookSkeleton from "./ui/orderbook-skeleton";

/* ============================== */
/* ========= Types ============== */
/* ============================== */

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

interface OrdersById {
  orders: Map<number, Order>;
}


const MemoizedRow = memo(OrderBookRow);

export default function Orderbook() {
  const socket = useSocket();
  const [displayData, setDisplayData] = useState<OrderBookState>({
    asks: new Map(),
    bids: new Map(),
  });
  const bookRef = useRef<OrderBookState>({ asks: new Map(), bids: new Map() });
  // ✅ ordersRef declared before updateOrders which depends on it
  const ordersRef = useRef<Map<number, Order>>(new Map());
  const pendingFills = useRef<Map<number, OrderFillEventData>>(new Map());
  const updateOrders = (updater: (prev: Map<number, Order>) => Map<number, Order>) => {
    const next = updater(ordersRef.current);
    ordersRef.current = next;
  };

  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerUpdate = () => {
    if (batchTimer.current) return;

    batchTimer.current = setTimeout(() => {
      // Functional update to ensure we use the latest ref values
      setDisplayData({
        asks: new Map(bookRef.current.asks),
        bids: new Map(bookRef.current.bids),
      });
      batchTimer.current = null;
    }, 100);
  };

  useEffect(() => {
    if (!socket) return;

    socket.onAny((eventName, ...args) => {
      console.log(`Incoming Event: ${eventName}`, args);
    });

    const handleSnapshot = (payload: any) => {
      console.log("asks:", payload);
      const asks = new Map<number, PriceLevel>();
      const bids = new Map<number, PriceLevel>();
      const orders = new Map<number, Order>();

      payload.orderbook.asks.forEach((n: any) => {
        const id = n.id;
        const p = n.price;
        const existing = asks.get(p);
        if (existing) {
          existing.quantity += n.quantity;
          existing.total = p * existing.quantity;
        } else {
          asks.set(p, { orderId: id, price: p, quantity: n.quantity, total: p * n.quantity });
        }
        orders.set(id, { orderId: id, price: p, quantity: n.quantity, timestamp: n.ts, side: "ask" });
      });

      payload.orderbook.bids.forEach((n: any) => {
        const id = n.id;
        const p = n.price;
        const existing = bids.get(p);
        if (existing) {
          existing.quantity += n.quantity;
          existing.total = p * existing.quantity;
        } else {
          bids.set(p, { orderId: id, price: p, quantity: n.quantity, total: p * n.quantity });
        }
        orders.set(id, { orderId: id, price: p, quantity: n.quantity, timestamp: n.ts, side: "bid" });
      });

      bookRef.current = { asks, bids };
      // ✅ seeds ordersRef so fill events can find orders
      updateOrders(() => orders);
      triggerUpdate();
    };

    const handleOrderPlaced = (data: any) => {
      console.log("order place event triggere:", data)
      const id = Number(data.id);
      const p = Number(data.p);
      const q = Number(data.q);
      const s: "bid" | "ask" = data.s;

      ordersRef.current.set(id, { orderId: id, price: p, quantity: q, timestamp: data.ts, side: s });
      const targetMap = s === "ask" ? bookRef.current.asks : bookRef.current.bids;

      const priceLevel = targetMap.get(p);
      if (priceLevel) {
        targetMap.set(p, {
          ...priceLevel,
          quantity: priceLevel.quantity + q,
          total: (priceLevel.quantity + q) * p,
        });
      } else {
        targetMap.set(p, { orderId: id, price: p, quantity: q, total: p * q });
      }
      if (pendingFills.current.has(id)) {
        const bufferedFill = pendingFills.current.get(id)!;
        pendingFills.current.delete(id);
        handleOrderFillEvent(bufferedFill);  // now safe to process
      }
      triggerUpdate();
    };

    const handleOrderCancelled = (data: any) => {
      const id = Number(data.id);
      const p = Number(data.p);
      const q = Number(data.q);
      const s: "bid" | "ask" = data.s;

      const targetMap = s === "ask" ? bookRef.current.asks : bookRef.current.bids;

      const priceLevel = targetMap.get(p);
      if (priceLevel) {
        const newQty = priceLevel.quantity - q;
        if (newQty <= 0) {
          targetMap.delete(p);
        } else {
          targetMap.set(p, {
            ...priceLevel,
            quantity: newQty,
            total: p * newQty,
          });
        }
      }

      // ✅ Direct ref mutation
      ordersRef.current.delete(id);

      triggerUpdate();
    };
    const handleOrderFillEvent = (data: any) => {
      console.log("fill evet triggered!")
      console.log("fill event data:", data);
      const {
        makerOrderId,
        takerOrderId,
        price,
        baseLotsFilled,
        baseLotsRemaining,
        timestamp,
        side,
      } = data;

      const makerSlab = side === "bid" ? bookRef.current.asks : bookRef.current.bids;
      const takerSlab = side === "bid" ? bookRef.current.bids : bookRef.current.asks;

      const takerOrder = ordersRef.current.get(Number(takerOrderId));

      // if taker not in ordersRef yet, order:placed hasn't arrived — buffer and wait
      if (!takerOrder) {
        console.warn("[fill] taker not found, buffering fill for takerOrderId:", takerOrderId);
        pendingFills.current.set(Number(takerOrderId), data);
        return;
      }

      // rest of your logic untouched below
      const makerOrder = ordersRef.current.get(Number(makerOrderId));
      if (makerOrder) {
        if (baseLotsRemaining === 0) {
          ordersRef.current.delete(Number(makerOrderId));
        } else {
          ordersRef.current.set(Number(makerOrderId), { ...makerOrder, quantity: baseLotsRemaining, timestamp });
        }
      }
      if (takerOrder) {
        const takerRemainingQty = takerOrder.quantity - baseLotsFilled;
        if (takerRemainingQty <= 0) {
          ordersRef.current.delete(Number(takerOrderId));
        } else {
          ordersRef.current.set(Number(takerOrderId), { ...takerOrder, quantity: takerRemainingQty, timestamp });
        }
      }

      const makerPriceLevel = makerSlab.get(price);
      if (makerPriceLevel) {
        const newMakerQty = makerPriceLevel.quantity - baseLotsFilled;
        if (newMakerQty <= 0) {
          makerSlab.delete(price);
        } else {
          makerSlab.set(price, { ...makerPriceLevel, quantity: newMakerQty, total: price * newMakerQty });
        }
      } else {
        console.warn("[fill] maker price level not found at price:", price);
      }

      if (takerOrder) {
        const takerLevel = takerSlab.get(takerOrder.price);
        if (takerLevel) {
          const newTakerQty = takerLevel.quantity - baseLotsFilled;
          if (newTakerQty <= 0) {
            takerSlab.delete(takerOrder.price);
          } else {
            takerSlab.set(takerOrder.price, { ...takerLevel, quantity: newTakerQty, total: takerOrder.price * newTakerQty });
          }
        } else {
          console.warn("[fill] taker price level not found at price:", takerOrder.price);
        }
      }

      triggerUpdate();
    };

    socket.on("snapshot", handleSnapshot);
    socket.on("tx:events", (events: any[]) => {
      for (const event of events) {
        if (event.type === "orderPlacedEvent") handleOrderPlaced(event.data);
        if (event.type === "orderFillEvent") handleOrderFillEvent(event.data);
        if (event.type === "OrderCancelledEvent") handleOrderCancelled(event.data);
      }
    });

    return () => {
      socket.off("snapshot", handleSnapshot);
      socket.off("tx:events");
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

      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium text-[var(--phoenix-text-subtle)]">
        <div>Price</div>
        <div className="text-right">AMOUNT SOL</div>
        <div className="text-right">AMOUNT USDC</div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {sortedAsks.map((level) => (
            <MemoizedRow key={level.price} {...level} side="ask" />
          ))}
        </div>

        <div className="px-3 py-1 bg-[var(--phoenix-bg-main)] text-[10px] text-[var(--phoenix-text-subtle)]">
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

// 100.99
// 100.990000
// 100990000
// 100990