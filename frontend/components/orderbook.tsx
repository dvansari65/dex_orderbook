"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

export default function Orderbook() {
  const socket = useSocket();
  const [orderbook, setOrderbook] = useState<OrderBookState>({
    asks: new Map(),
    bids: new Map(),
  });

  // Use a Ref for the latest state to avoid closure staleness
  const stateRef = useRef(orderbook);
  stateRef.current = orderbook;

  /* ---------- Memoized Calculations ---------- */

  const sortedAsks = useMemo(() => {
    return [...orderbook.asks.values()]
      .sort((a, b) => a.price - b.price)
      .slice(0, DISPLAY_LIMIT)
      .reverse();
  }, [orderbook.asks]);

  const sortedBids = useMemo(() => {
    return [...orderbook.bids.values()]
      .sort((a, b) => b.price - a.price)
      .slice(0, DISPLAY_LIMIT);
  }, [orderbook.bids]);

  const spread = useMemo(() => {
    const bestAsk = [...orderbook.asks.keys()].sort((a, b) => a - b)[0];
    const bestBid = [...orderbook.bids.keys()].sort((a, b) => b - a)[0];
    return bestAsk && bestBid ? (bestAsk - bestBid).toFixed(4) : "—";
  }, [orderbook.asks, orderbook.bids]);

  /* ---------- Update Handlers ---------- */

  const handlePlace = useCallback((p: number, q: number, s: Side) => {
    setOrderbook((prev) => {
      const newMap = new Map(s === "ask" ? prev.asks : prev.bids);
      const existing = newMap.get(p);
      const newQty = (existing?.quantity || 0) + q;
      newMap.set(p, { price: p, quantity: newQty, total: p * newQty });
      
      return {
        ...prev,
        [s === "ask" ? "asks" : "bids"]: newMap,
      };
    });
  }, []);

  const handleFill = useCallback((p: number, q: number, s: Side) => {
    setOrderbook((prev) => {
      const newMap = new Map(s === "ask" ? prev.asks : prev.bids);
      const existing = newMap.get(p);
      
      if (!existing) return prev;
      
      const newQty = existing.quantity - q;
      if (newQty <= 0) {
        newMap.delete(p);
      } else {
        newMap.set(p, { price: p, quantity: newQty, total: p * newQty });
      }
      
      return {
        ...prev,
        [s === "ask" ? "asks" : "bids"]: newMap,
      };
    });
  }, []);

  const handleCancel = useCallback((p: number, s: Side) => {
    setOrderbook((prev) => {
      const newMap = new Map(s === "ask" ? prev.asks : prev.bids);
      newMap.delete(p);
      
      return {
        ...prev,
        [s === "ask" ? "asks" : "bids"]: newMap,
      };
    });
  }, []);

  /* ---------- Socket Handlers ---------- */

  useEffect(() => {
    if (!socket) return;

    // Handle initial snapshot
    const handleSnapshot = (payload: any) => {
      const asks = new Map();
      const bids = new Map();
      
      payload.orderbook.asks.forEach((n: any) => {
        const p = Number(n.price);
        const q = Number(n.quantity);
        asks.set(p, { price: p, quantity: q, total: p * q });
      });

      payload.orderbook.bids.forEach((n: any) => {
        const p = Number(n.price);
        const q = Number(n.quantity);
        bids.set(p, { price: p, quantity: q, total: p * q });
      });

      setOrderbook({ asks, bids });
    };

    // Handle lightweight events (shortened keys: p, q, s, ts)
    const handlePlaced = (data: any) => {
      const side = data.s as Side;
      handlePlace(data.p, data.q, side);
    };

    const handleFilled = (data: any) => {
      const side = data.s as Side;
      handleFill(data.p, data.q, side);
    };

    const handlePartial = (data: any) => {
      const side = data.s as Side;
      handleFill(data.p, data.q, side);
    };

    const handleCancelled = (data: any) => {
      const side = data.s as Side;
      handleCancel(data.p, side);
    };

    // Register listeners
    socket.on("snapshot", handleSnapshot);
    socket.on("order:placed", handlePlaced);
    socket.on("order:filled", handleFilled);
    socket.on("order:partial", handlePartial);
    socket.on("order:cancelled", handleCancelled);

    return () => {
      socket.off("snapshot", handleSnapshot);
      socket.off("order:placed", handlePlaced);
      socket.off("order:filled", handleFilled);
      socket.off("order:partial", handlePartial);
      socket.off("order:cancelled", handleCancelled);
    };
  }, [socket, handlePlace, handleFill, handleCancel]);

  /* ============================== */
  /* ========= Render ============= */
  /* ============================== */

  return (
    <div className="w-full h-full rounded-2xl" style={{ background: "#FAF8F6" }}>
      {/* Header */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold" style={{ color: "var(--phoenix-text-primary)" }}>
          Order Book
        </h3>
      </div>

      {/* Column Headers */}
      <div
        className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium"
        style={{ color: "var(--phoenix-text-subtle)" }}
      >
        <div>Price</div>
        <div className="text-right">AMOUNT SOL</div>
        <div className="text-right">AMOUNT USDC</div>
      </div>

      <div className="flex flex-col h-[calc(100%-80px)]">
        {/* Asks */}
        <div className="overflow-y-auto flex flex-col justify-end h-[calc(50%-20px)]">
          {sortedAsks.length ? (
            sortedAsks.map((level) => (
              <OrderBookRow key={level.price} {...level} side="ask" />
            ))
          ) : (
            <EmptyState label="No sell orders" />
          )}
        </div>

        {/* Spread */}
        <div className="px-3 py-2" style={{ background: "var(--phoenix-bg-main)" }}>
          <span className="text-[10px]" style={{ color: "var(--phoenix-text-subtle)" }}>
            Spread: {spread}
          </span>
        </div>

        {/* Bids */}
        <div className="overflow-y-auto h-[calc(50%-20px)]">
          {sortedBids.length ? (
            sortedBids.map((level) => (
              <OrderBookRow key={level.price} {...level} side="bid" />
            ))
          ) : (
            <EmptyState label="No buy orders" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== */
/* ===== Small Components ======= */
/* ============================== */

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center h-full text-xs"
      style={{ color: "var(--phoenix-text-subtle)" }}
    >
      {label}
    </div>
  );
}