// components/fills-tab.tsx
"use client"

import { memo } from "react";

interface Fill {
  price: number;
  quantity: number;
  side: 'bid' | 'ask';
  timestamp: string;
}

interface FillsTabProps {
  fills: Fill[];
}

const FillsTab = memo(({ fills }: FillsTabProps) => {
  if (fills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 py-8">
        <span className="text-[11px] text-subtle">No fills yet</span>
      </div>
    );
  }

  return (
    <>
      {fills.map((fill, i) => (
        <div key={i} className="grid grid-cols-5 items-center px-4 py-2.5 hover:bg-subtle transition-colors duration-100">
          <span className={`text-[11px] font-bold tracking-wide ${fill.side === 'bid' ? 'text-bid' : 'text-ask'}`}>
            {fill.side === 'bid' ? '▲ BUY' : '▼ SELL'}
          </span>
          <span className="text-[12px] font-semibold text-primary tabular-nums">
            ${fill.price.toFixed(2)}
          </span>
          <span className="text-[12px] text-secondary tabular-nums">
            {fill.quantity.toFixed(4)}
          </span>
          <span className="text-[11px] text-secondary tabular-nums">
            {new Date(fill.timestamp).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit' 
            })}
          </span>
          <span className="text-[11px] font-semibold text-accent">Filled</span>
        </div>
      ))}
    </>
  );
});

FillsTab.displayName = 'FillsTab';
export default FillsTab;