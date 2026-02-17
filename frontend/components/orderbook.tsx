"use client";

import { useEffect, useMemo, useState, useRef, memo } from "react";
import { useSocket } from "@/providers/SocketProvider";
import OrderBookRow from "./market/initial-snapshot";
import { OrderFillEventData } from "@/types/events";

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
  const [orders, setOrders] = useState<OrdersById>({ orders: new Map() });

  const bookRef = useRef<OrderBookState>({ asks: new Map(), bids: new Map() });
  // ✅ ordersRef declared before updateOrders which depends on it
  const ordersRef = useRef<Map<number, Order>>(new Map());

  const updateOrders = (updater: (prev: Map<number, Order>) => Map<number, Order>) => {
    const next = updater(ordersRef.current);
    ordersRef.current = next;
    setOrders({ orders: next });
  };

  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerUpdate = () => {
    if (batchTimer.current) return;
    batchTimer.current = setTimeout(() => {
      setDisplayData({
        asks: new Map(bookRef.current.asks),
        bids: new Map(bookRef.current.bids),
      });
      batchTimer.current = null;
    }, 100);
  };

  useEffect(() => {
    if (!socket) return;

    const handleSnapshot = (payload: any) => {
      console.log("asks:", payload.orderbook.asks);
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

    const handleUpdate = (data: any, type: "placed" | "cancelled") => {
      console.log("data:", data);
      const { p, q, s, ts, id } = data;
      const targetMap = s === "ask" ? bookRef.current.asks : bookRef.current.bids;

      if (type === "cancelled") {
        const priceLevel = targetMap.get(p);
        if (!priceLevel) return;

        const newQty = priceLevel.quantity - q;

        // ✅ guard against negative quantities leaking into UI
        if (newQty <= 0) {
          targetMap.delete(p);
        } else {
          targetMap.set(p, {
            ...priceLevel,
            quantity: newQty,
            total: priceLevel.price * newQty,
          });
        }
        updateOrders((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }

      if (type === "placed") {
        updateOrders((prev) => {
          const next = new Map(prev);
          next.set(id, { orderId: id, price: p, quantity: q, timestamp: ts, side: s });
          return next;
        });

        const priceLevel = targetMap.get(p);
        if (priceLevel) {
          targetMap.set(p, {
            ...priceLevel,
            quantity: priceLevel.quantity + q,
            total: (priceLevel.quantity + q) * priceLevel.price,
          });
        } else {
          targetMap.set(p, { orderId: id, price: p, quantity: q, total: p * q });
        }
      }

      triggerUpdate();
    };

    const handleOrderFillEvent = (data: OrderFillEventData) => {
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

      // ✅ read takerOrder BEFORE updateOrders mutates ordersRef
      const takerOrder = ordersRef.current.get(takerOrderId);
      const makerOrder = ordersRef.current.get(makerOrderId);
      if (!makerOrder) {
        console.warn("[fill] makerOrder not found, skipping fill:", makerOrderId);
        return;
      }
      console.log("taker order:", takerOrder);

      updateOrders((prev) => {
        const prevOrders = new Map(prev);
        const makerData = prevOrders.get(makerOrderId);
        if (!makerData) {
          return prevOrders;
        }

        if (baseLotsRemaining === 0) {
          prevOrders.delete(makerOrderId);
        } else {
          prevOrders.set(makerOrderId, { ...makerData, quantity: baseLotsRemaining, timestamp });
        }
        const takerData = prevOrders.get(takerOrderId);

        if (takerData) {
          const takerRemainingQty = takerData.quantity - baseLotsFilled;
          if (takerRemainingQty <= 0) {
            prevOrders.delete(takerOrderId);
          } else {
            prevOrders.set(takerOrderId, { ...takerData, quantity: takerRemainingQty, timestamp });
          }
        }
        return prevOrders;
      });

      // update maker slab
      const makerPriceLevel = makerSlab.get(price);
      console.log("maker price level:", makerPriceLevel);
      if (makerPriceLevel) {
        const newMakerQty = makerPriceLevel.quantity - baseLotsFilled;
        if (newMakerQty <= 0) {
          makerSlab.delete(price);
        } else {
          makerSlab.set(price, {
            ...makerPriceLevel,
            quantity: newMakerQty,
            total: price * newMakerQty,
          });
        }
      }
      const takerLooupPrice = takerOrder ? takerOrder.price : price;
      const existingTakerLevel = takerSlab.get(takerLooupPrice)
      // update taker slab
      if (existingTakerLevel) {
        console.log("existing taker level:", existingTakerLevel);

        // ✅ no early return — falls through to triggerUpdate
        if (existingTakerLevel) {
          const newTakerQty = existingTakerLevel.quantity - baseLotsFilled;
          if (newTakerQty <= 0) {
            takerSlab.delete(takerLooupPrice);   // ✅ consistent key: takerOrder.price
          } else {
            takerSlab.set(takerLooupPrice, {     // ✅ consistent key: takerOrder.price
              ...existingTakerLevel,
              quantity: newTakerQty,
              total: newTakerQty * takerLooupPrice,
            });
          }
        }
      }

      triggerUpdate();
    };

    socket.on("snapshot", handleSnapshot);
    socket.on("order:placed", (d) => handleUpdate(d, "placed"));
    socket.on("order:filled", handleOrderFillEvent);
    socket.on("order:cancelled", (d) => handleUpdate(d, "cancelled"));

    return () => {
      socket.off("snapshot");
      socket.off("order:placed");
      socket.off("order:filled");
      socket.off("order:cancelled");
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