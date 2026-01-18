"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/providers/SocketProvider";
import InitialSnapShot from "./market/initial-snapshot";
import { OrderPlacedEvent, Side } from "@/types/events";
import OrderBookRow from "./market/initial-snapshot";

interface OrderNode {
  orderId: number;
  price: number;
  quantity: number;
  owner: string;
  side: Side;
}

interface PriceLevel {
  price: number;
  quantity: number;
  total: number;
  orders: OrderNode[];
}

export default function Orderbook() {
  const [orderbook, setOrderBook] = useState<{
    asks: Map<string, PriceLevel>;
    bids: Map<string, PriceLevel>;
  }>({
    asks: new Map(),
    bids: new Map(),
  });

  const socket = useSocket();

  // Convert Map to sorted array for rendering
  const sortedAsks = useMemo(() => {
    return Array.from(orderbook.asks.values())
      .sort((a, b) => a.price - b.price) // Ascending (lowest first)
      .slice(0, 7);
  }, [orderbook.asks]);

  const sortedBids = useMemo(() => {
    return Array.from(orderbook.bids.values())
      .sort((a, b) => b.price - a.price) // Descending (highest first)
      .slice(0, 10);
  }, [orderbook.bids]);

  useEffect(() => {
    if (!socket) return;

    // Initialize orderbook from snapshot
    const handleInitialSnapshot = (data: any) => {
      console.log("initial snapshot:", data);

      const asksMap = new Map<string, PriceLevel>();
      const bidsMap = new Map<string, PriceLevel>();

      // Process asks
      (data.asks || []).forEach((order: OrderNode) => {
        const priceKey = order.price.toString();
        const existing = asksMap.get(priceKey);

        if (existing) {
          existing.quantity += order.quantity;
          existing.total += order.price * order.quantity;
          existing.orders.push(order);
        } else {
          asksMap.set(priceKey, {
            price: order.price,
            quantity: order.quantity,
            total: order.price * order.quantity,
            orders: [order],
          });
        }
      });

      // Process bids
      (data.bids || []).forEach((order: OrderNode) => {
        const priceKey = order.price.toString();
        const existing = bidsMap.get(priceKey);

        if (existing) {
          existing.quantity += order.quantity;
          existing.total += order.price * order.quantity;
          existing.orders.push(order);
        } else {
          bidsMap.set(priceKey, {
            price: order.price,
            quantity: order.quantity,
            total: order.price * order.quantity,
            orders: [order],
          });
        }
      });

      setOrderBook({ asks: asksMap, bids: bidsMap });
    };

    // Handle new order placement
    const handleOrderPlaceEvent = (data: OrderPlacedEvent) => {
      console.log("OrderPlacedEvent:", data);

      const newOrder: OrderNode = {
        orderId: data.orderId,
        price: data.price,
        quantity: data.quantity,
        owner: data.owner.toString(),
        side: data.side,
      };

      setOrderBook((prev) => {
        const side = data.side === "bid" ? "bids" : "asks";
        const priceKey = data.price.toString();

        // Clone the Map for immutability
        const updatedMap = new Map(prev[side]);
        const existing = updatedMap.get(priceKey);

        if (existing) {
          // Update existing price level
          updatedMap.set(priceKey, {
            price: data.price,
            quantity: existing.quantity + data.quantity,
            total: existing.total + data.price * data.quantity,
            orders: [...existing.orders, newOrder],
          });
        } else {
          // Create new price level
          updatedMap.set(priceKey, {
            price: data.price,
            quantity: data.quantity,
            total: data.price * data.quantity,
            orders: [newOrder],
          });
        }

        return {
          ...prev,
          [side]: updatedMap,
        };
      });
    };

    socket.on("initial-snapshot", handleInitialSnapshot);
    socket.on("order-place-event", handleOrderPlaceEvent);

    return () => {
      socket.off("initial-snapshot", handleInitialSnapshot);
      socket.off("order-place-event", handleOrderPlaceEvent);
    };
  }, [socket]);

  return (
    <div className="w-full h-full rounded-2xl" style={{ background: '#FAF8F6' }}>
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold" style={{ color: 'var(--phoenix-text-primary)' }}>
          Order Book
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium"
        style={{
          color: 'var(--phoenix-text-subtle)',
        }}>
        <div className="text-left">Price</div>
        <div className="text-right">
          <span className="mr-1 text-gray-500">AMOUNT</span>
          <span>SOL</span>
        </div>
        <div className="text-right">
          <span className="mr-1 text-gray-500">AMOUNT</span>
          <span>USDC</span>
        </div>
      </div>

      <div className="flex flex-col h-[calc(100%-80px)]">
        {/* Asks Section (Sell Orders) */}
        <div className="relative overflow-y-auto flex flex-col justify-end" style={{ height: 'calc(50% - 20px)' }}>
          {sortedAsks.length > 0 ? (
            sortedAsks.map((level) => (
              <OrderBookRow
                key={level.price}
                price={level.price}
                quantity={level.quantity}
                total={level.total}
                side="ask"
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--phoenix-text-subtle)' }}>
              No sell orders
            </div>
          )}
        </div>

        {/* Middle Divider */}
        <div className="px-3 py-2 flex-shrink-0"
          style={{
            background: 'var(--phoenix-bg-main)',
          }}>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--phoenix-text-subtle)' }}>
              Orders
            </span>
          </div>
        </div>

        {/* Bids Section (Buy Orders) */}
        <div className="relative overflow-y-auto" style={{ height: 'calc(50% - 20px)' }}>
          {sortedBids.length > 0 ? (
            sortedBids.map((level) => (
              <OrderBookRow
                key={level.price}
                price={level.price}
                quantity={level.quantity}
                total={level.total}
                side="bid"
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--phoenix-text-subtle)' }}>
              No buy orders
            </div>
          )}
        </div>
      </div>
    </div>
  );
}