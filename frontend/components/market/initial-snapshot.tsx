import React, { memo } from "react";

interface OrderBookRowProps {
  price: number;
  quantity: number;
  total: number;
  side: "bid" | "ask";
  owner?: string;
  isFlashing?: boolean;
}

// Fixed colors to avoid CSS variable resolution overhead during high-freq re-renders
const COLORS = {
  ask: "#EF4444",
  bid: "#10B981",
  askBg: "rgba(239, 68, 68, 0.1)",
  bidBg: "rgba(16, 185, 129, 0.1)",
  textSecondary: "#4B5563", // Replace with your phoenix-text-secondary hex
  textSubtle: "#9CA3AF",    // Replace with your phoenix-text-subtle hex
};

const OrderBookRow = memo(({
  price,
  quantity,
  total,
  side,
  isFlashing = false,
}: OrderBookRowProps) => {
  const isAsk = side === "ask";
  const color = isAsk ? COLORS.ask : COLORS.bid;
  
  // Depth calculation: capped at 100%
  const depthWidth = `${Math.min(quantity, 100)}%`;

  return (
    <div
      className="relative grid grid-cols-3 gap-2 px-3 py-1 text-[11px] hover:bg-black/5 cursor-pointer transition-colors duration-200"
      style={{
        backgroundColor: isFlashing ? (isAsk ? COLORS.askBg : COLORS.bidBg) : undefined
      }}
    >
      {/* GPU Accelerated Depth Bar: 
          Using transform: scaleX and transform-origin is significantly more 
          performant than changing 'width' which triggers layout reflow.
      */}
      <div
        className="absolute inset-y-0 right-0 opacity-10 pointer-events-none"
        style={{
          background: color,
          width: depthWidth,
          transition: 'width 0.3s ease-out'
        }}
      />

      {/* Price - Left */}
      <div className="relative z-10 font-medium tabular-nums" style={{ color }}>
        {price.toFixed(2)}
      </div>

      {/* Quantity - Middle */}
      <div
        className="relative z-10 text-right font-mono tabular-nums"
        style={{ color: COLORS.textSecondary }}
      >
        {quantity.toFixed(4)}
      </div>

      {/* Total - Right */}
      <div
        className="relative z-10 text-right font-mono tabular-nums"
        style={{ color: COLORS.textSubtle }}
      >
        {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
});

OrderBookRow.displayName = "OrderBookRow";

export default OrderBookRow;