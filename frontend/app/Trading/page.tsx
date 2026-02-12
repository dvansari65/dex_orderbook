"use client"

import React, { memo } from "react";
import Orderbook from "@/components/orderbook";
import SwappingInterface from "@/components/swapping-interface";
import CandleChart from "@/components/CandleGraph";

const Trading = memo(() => {
  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[var(--phoenix-bg-subtle)]">
      {/* Left side: Static or slow-changing components */}
      <div className="flex flex-col flex-1 p-2 gap-2">
        <div className="flex-1 rounded-2xl min-h-[300px] bg-[#FAF8F6] flex items-center justify-center text-[var(--phoenix-text-subtle)]">
          <CandleChart/>
        </div>
        <div className="rounded-2xl h-64 lg:h-80 bg-[#FAF8F6] flex items-center justify-center text-[var(--phoenix-text-subtle)]">
          Order History
        </div>
      </div>

      {/* Middle: Orderbook */}
      <div className="w-full lg:w-80 flex flex-col border-t lg:border-t-0 lg:border-l border-black/5">
        <div className="flex-1 p-2 min-h-[300px]">
          <Orderbook />
        </div>
        <div className="h-[250px]" />
      </div>

      {/* Right: Swap */}
      <div className="w-full lg:w-auto p-2 flex justify-center lg:justify-start">
        <SwappingInterface />
      </div>
    </div>
  );
});

export default Trading;