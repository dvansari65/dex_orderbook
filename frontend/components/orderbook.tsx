"use client";

import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { useSocket } from "@/providers/SocketProvider";
import OrderBookRow from "./market/initial-snapshot";

/* ============================== */
/* ========= Types ============== */
/* ============================== */
type Side = "bid" | "ask";

interface PriceLevel {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookState {
  asks: Map<number, PriceLevel>;
  bids: Map<number, PriceLevel>;
}

const DISPLAY_LIMIT = 20;

const MemoizedRow = memo(OrderBookRow);

export default function Orderbook() {
  const socket = useSocket();
  const [displayData, setDisplayData] = useState<OrderBookState>({ asks: new Map(), bids: new Map() });
  
  // Use Refs for data to prevent re-renders on every socket message
  const bookRef = useRef<OrderBookState>({ asks: new Map(), bids: new Map() });
  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  // Throttled Update: Batches multiple socket events into one render
  const triggerUpdate = () => {
    if (batchTimer.current) return;
    batchTimer.current = setTimeout(() => {
      // Create new Map references only when rendering to trigger React's diffing
      setDisplayData({
        asks: new Map(bookRef.current.asks),
        bids: new Map(bookRef.current.bids),
      });
      batchTimer.current = null;
    }, 100); // 100ms throttle is standard for trading UI
  };

  useEffect(() => {
    if (!socket) return;

    const handleSnapshot = (payload: any) => {
      const asks = new Map();
      const bids = new Map();
      payload.orderbook.asks.forEach((n: any) => {
        const p = Number(n.price);
        asks.set(p, { price: p, quantity: Number(n.quantity), total: p * Number(n.quantity) });
      });
      payload.orderbook.bids.forEach((n: any) => {
        const p = Number(n.price);
        bids.set(p, { price: p, quantity: Number(n.quantity), total: p * Number(n.quantity) });
      });
      bookRef.current = { asks, bids };
      triggerUpdate();
    };

    const handleUpdate = (data: any, type: 'placed' | 'filled' | 'cancelled') => {
      const { p, q, s } = data;
      const targetMap = s === "ask" ? bookRef.current.asks : bookRef.current.bids;

      if (type === 'cancelled' || (type === 'filled' && (targetMap.get(p)?.quantity || 0) <= q)) {
        targetMap.delete(p);
      } else {
        const existing = targetMap.get(p);
        const newQty = type === 'placed' ? (existing?.quantity || 0) + q : (existing?.quantity || 0) - q;
        targetMap.set(p, { price: p, quantity: newQty, total: p * newQty });
      }
      triggerUpdate();
    };

    socket.on("snapshot", handleSnapshot);
    socket.on("order:placed", (d) => handleUpdate(d, 'placed'));
    socket.on("order:filled", (d) => handleUpdate(d, 'filled'));
    socket.on("order:partial", (d) => handleUpdate(d, 'filled'));
    socket.on("order:cancelled", (d) => handleUpdate(d, 'cancelled'));

    return () => {
      socket.off("snapshot");
      socket.off("order:placed");
      socket.off("order:filled");
      socket.off("order:partial");
      socket.off("order:cancelled");
      if (batchTimer.current) clearTimeout(batchTimer.current);
    };
  }, [socket]);

  // Deriving sorted data from displayData (which only updates every 100ms)
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
    return (bestAsk !== Infinity && bestBid !== -Infinity) ? (bestAsk - bestBid).toFixed(4) : "—";
  }, [displayData.asks, displayData.bids]);

  return (
    <div className="w-full h-full rounded-2xl bg-[#FAF8F6] flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--phoenix-text-primary)]">Order Book</div>
      
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium text-[var(--phoenix-text-subtle)]">
        <div>Price</div>
        <div className="text-right">AMOUNT SOL</div>
        <div className="text-right">AMOUNT USDC</div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {sortedAsks.map(level => <MemoizedRow key={level.price} {...level} side="ask" />)}
        </div>

        <div className="px-3 py-1 bg-[var(--phoenix-bg-main)] text-[10px] text-[var(--phoenix-text-subtle)]">
          Spread: {spread}
        </div>

        <div className="flex-1 overflow-hidden">
          {sortedBids.map(level => <MemoizedRow key={level.price} {...level} side="bid" />)}
        </div>
      </div>
    </div>
  );
}