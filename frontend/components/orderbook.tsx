"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/providers/SocketProvider";
import { Slab, Node } from "@/types/slab";

export default function Orderbook() {
  const [asks, setAsks] = useState<Slab | null>(null);
  const [bids, setBids] = useState<Slab | null>(null);
  
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("initial-snapshot", (data: any) => {
      console.log("initial snapshot:", data);
      setAsks(data.asks);
      setBids(data.bids);
    });
    socket.on("update-snapshot", (data: any) => {
      console.log("updated snapshot:", data);
      setAsks(data.asks);
      setBids(data.bids);
    });

    return () => {
      socket.off("initial-snapshot");
    };
  }, [socket,asks,bids]);

  // Filter only leaf nodes (actual orders)
  const getLeafNodes = (nodes: Node[] | []): Node[] => {
    if (!nodes || nodes.length === 0) return [];
    return nodes.filter((node: any) => node.price && node.quantity);
  };

  // Convert to number safely
  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') return parseFloat(value);
    return 0;
  };

  const askNodes = asks ? getLeafNodes(asks.nodes) : [];
  const bidNodes = bids ? getLeafNodes(bids.nodes) : [];

  return (
    <div className="w-full h-full" style={{ background: 'var(--phoenix-bg-subtle)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--phoenix-border-light)' }}>
        <h3 className="text-xs font-semibold" style={{ color: 'var(--phoenix-text-primary)' }}>
          Order Book
        </h3>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium border-b" 
           style={{ 
             color: 'var(--phoenix-text-subtle)',
             borderColor: 'var(--phoenix-border-light)' 
           }}>
        <div className="text-left">Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Owner</div>
      </div>

      <div className="flex flex-col h-[calc(100%-80px)] overflow-hidden">
        {/* ASKS - Red (Sell orders) */}
        <div className="relative flex-1 overflow-y-auto">
          {askNodes.length > 0 ? (
            askNodes.slice(0, 15).map((node) => (
              <div
                key={`ask-${node?.orderId}`}
                className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-[11px] hover:opacity-80 cursor-pointer transition-opacity"
              >
                {/* Price - Red */}
                <div className="relative z-10 font-medium" style={{ color: '#EF4444' }}>
                  {toNumber(node.price).toFixed(2)}
                </div>
                {/* Quantity */}
                <div className="relative z-10 text-right" style={{ color: 'var(--phoenix-text-secondary)' }}>
                  {toNumber(node.quantity).toFixed(4)}
                </div>
                {/* Owner (truncated) */}
                <div className="relative z-10 text-right truncate" style={{ color: 'var(--phoenix-text-subtle)' }}>
                  {String(node.owner).slice(0, 4)}...{String(node.owner).slice(-4)}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--phoenix-text-subtle)' }}>
              No sell orders
            </div>
          )}
        </div>

        {/* SPREAD */}
        <div className="px-3 py-2 border-y flex-shrink-0" 
             style={{ 
               background: 'var(--phoenix-bg-main)',
               borderColor: 'var(--phoenix-border-light)' 
             }}>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--phoenix-text-subtle)' }}>
              Orders
            </span>
            <div className="flex items-center gap-2">
              <span style={{ color: '#EF4444' }}>
                Asks: {asks?.leafCount || 0}
              </span>
              <span style={{ color: '#22C55E' }}>
                Bids: {bids?.leafCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* BIDS - Green (Buy orders) */}
        <div className="relative flex-1 overflow-y-auto">
          {bidNodes.length > 0 ? (
            bidNodes.slice(0, 15).map((node, idx) => (
              <div
                key={`bid-${node.orderId || idx}`}
                className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-[11px] hover:opacity-80 cursor-pointer transition-opacity"
              >
                {/* Price - Green */}
                <div className="relative z-10 font-medium" style={{ color: '#22C55E' }}>
                  {toNumber(node.price).toFixed(2)}
                </div>
                {/* Quantity */}
                <div className="relative z-10 text-right" style={{ color: 'var(--phoenix-text-secondary)' }}>
                  {toNumber(node.quantity).toFixed(4)}
                </div>
                {/* Owner (truncated) */}
                <div className="relative z-10 text-right truncate" style={{ color: 'var(--phoenix-text-subtle)' }}>
                  {String(node.owner).slice(0, 4)}...{String(node.owner).slice(-4)}
                </div>
              </div>
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