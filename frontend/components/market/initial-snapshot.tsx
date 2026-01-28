import React, { memo } from "react";

interface OrderBookRowProps {
  price: number;
  quantity: number;
  total: number;
  side: "bid" | "ask";
  owner?: string;
  isFlashing?: boolean;
}

const OrderBookRow = memo(function OrderBookRow({
  price,
  quantity,
  total,
  side,
  owner,
  isFlashing = false,
}: OrderBookRowProps) {
  const priceColor = side === "ask" ? "#EF4444" : "#10B981"; // Red for asks, Green for bids
  
  return (
    <div
      className={`relative grid grid-cols-3 gap-2 px-3 py-1.5 text-[11px] hover:opacity-80 cursor-pointer transition-all duration-300 ${
        isFlashing ? "bg-opacity-20" : ""
      }`}
      style={{
        backgroundColor: isFlashing 
          ? (side === "ask" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)")
          : "transparent"
      }}
    >
      {/* Background fill indicator for depth visualization */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: side === "ask" 
            ? "linear-gradient(to left, #EF4444 0%, transparent 100%)"
            : "linear-gradient(to left, #10B981 0%, transparent 100%)",
          width: `${Math.min((quantity / 100) * 100, 100)}%`,
          right: 0,
        }}
      />

      {/* Price */}
      <div className="relative z-10 font-medium" style={{ color: priceColor }}>
        {price.toFixed(2)}
      </div>

      {/* Quantity (SOL) */}
      <div
        className="relative z-10 text-right font-mono"
        style={{ color: "var(--phoenix-text-secondary)" }}
      >
        {quantity.toFixed(4)}
      </div>

      {/* Total (USDC) */}
      <div
        className="relative z-10 text-right font-mono"
        style={{ color: "var(--phoenix-text-subtle)" }}
      >
        {total.toFixed(2)}
      </div>
    </div>
  );
});

export default OrderBookRow;