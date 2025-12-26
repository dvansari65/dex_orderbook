import React from "react";

interface InitialSnapShotProps {
  orderId: string;
  price: number;
  quantity: number;
  owner: string;
}

function InitialSnapShot({
  orderId,
  price,
  quantity,
  owner,
}: InitialSnapShotProps) {
  return (
      <div
        key={`ask-${orderId}`}
        className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-[11px] hover:opacity-80 cursor-pointer transition-opacity"
      >
        {/* Price - Red */}
        <div className="relative z-10 font-medium" style={{ color: "#EF4444" }}>
          {price.toFixed(2)}
        </div>
        {/* Quantity */}
        <div
          className="relative z-10 text-right"
          style={{ color: "var(--phoenix-text-secondary)" }}
        >
          {quantity.toFixed(4)}
        </div>
        {/* Owner (truncated) */}
        <div
          className="relative z-10 text-right truncate"
          style={{ color: "var(--phoenix-text-subtle)" }}
        >
          {String(owner).slice(0, 4)}...{String(owner).slice(-4)}
        </div>
    </div>
  );
}

export default InitialSnapShot;
