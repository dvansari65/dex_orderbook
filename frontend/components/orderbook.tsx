"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSocket } from "@/providers/SocketProvider";
import OrderBookRow from "./market/initial-snapshot";
import { OrderNode } from "@/types/slab";

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

// Unified Event for the Indexer
interface OrderUpdate {
  type: "PLACE" | "FILL" | "CANCEL";
  side: Side;
  price: number;
  quantity: number; // Delta or New total depending on type
}

const DISPLAY_LIMIT = 20;

export default function Orderbook() {
  const socket = useSocket();
  const [orderbook, setOrderbook] = useState<OrderBookState>({
    asks: new Map(),
    bids: new Map(),
  });

  // Use a Ref for the latest state to avoid closure staleness in socket listeners
  const stateRef = useRef(orderbook);
  stateRef.current = orderbook;

  /* ---------- Memoized Calculations ---------- */

  const sortedAsks = useMemo(() => {
    return [...orderbook.asks.values()]
      .sort((a, b) => a.price - b.price) // Asks: Low to High
      .slice(0, DISPLAY_LIMIT)
      .reverse(); // Display high prices at top
  }, [orderbook.asks]);

  const sortedBids = useMemo(() => {
    return [...orderbook.bids.values()]
      .sort((a, b) => b.price - a.price) // Bids: High to Low
      .slice(0, DISPLAY_LIMIT);
  }, [orderbook.bids]);

  const spread = useMemo(() => {
    const bestAsk = [...orderbook.asks.keys()].sort((a, b) => a - b)[0];
    const bestBid = [...orderbook.bids.keys()].sort((a, b) => b - a)[0];
    return bestAsk && bestBid ? (bestAsk - bestBid).toFixed(4) : "—";
  }, [orderbook.asks, orderbook.bids]);

  /* ---------- Unified State Updater ---------- */

  const updateOrderbook = useCallback((update: OrderUpdate) => {
    const { side, price, quantity, type } = update;
    if (price <= 0) return;

    setOrderbook((prev) => {
      const newMap = new Map(side === "ask" ? prev.asks : prev.bids);
      const existing = newMap.get(price);

      if (type === "PLACE") {
        const newQty = (existing?.quantity || 0) + quantity;
        newMap.set(price, { price, quantity: newQty, total: price * newQty });
      } 
      else if (type === "FILL" || type === "CANCEL") {
        if (!existing) return prev;
        const newQty = existing.quantity - quantity;
        if (newQty <= 0) {
          newMap.delete(price);
        } else {
          newMap.set(price, { price, quantity: newQty, total: price * newQty });
        }
      }

      return {
        ...prev,
        [side === "ask" ? "asks" : "bids"]: newMap,
      };
    });
  }, []);

  /* ---------- Socket Handlers ---------- */

  useEffect(() => {
    if (!socket) return;

    // Handle Snapshot
    socket.on("initial-snapshot", (payload) => {
      const asks = new Map();
      const bids = new Map();
      
      payload.asks.forEach((n: any) => {
        const p = Number(n.price);
        const q = Number(n.quantity);
        asks.set(p, { price: p, quantity: q, total: p * q });
      });

      payload.bids.forEach((n: any) => {
        const p = Number(n.price);
        const q = Number(n.quantity);
        bids.set(p, { price: p, quantity: q, total: p * q });
      });

      setOrderbook({ asks, bids });
    });

    // Handle Live Events
    socket.on("order-place-event", (data) => 
      updateOrderbook({ ...data, type: "PLACE", side: data.side.toLowerCase() })
    );
    
    socket.on("order-fill-event", (data) => 
      updateOrderbook({ ...data, type: "FILL", side: data.side.toLowerCase() })
    );

    return () => {
      socket.off("initial-snapshot");
      socket.off("order-place-event");
      socket.off("order-fill-event");
    };
  }, [socket, updateOrderbook]);
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
