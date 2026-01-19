import Orderbook from "@/components/orderbook";
import RecentTrades from "@/components/recent-orders";
import SwappingInterface from "@/components/swapping-interface";

function Trading() {
  return (
    <div
      className="w-full min-h-screen flex flex-col lg:flex-row overflow-hidden"
      style={{ background: "var(--phoenix-bg-subtle)" }}
    >
      {/* ================= LEFT: Chart + Order History ================= */}
      <div className="flex flex-col flex-1 p-2 gap-2">
        {/* Candle Graph */}
        <div
          className="flex-1 rounded-2xl min-h-[300px]"
          style={{ background: "#FAF8F6" }}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: "var(--phoenix-text-subtle)" }}
          >
            Candle Graph
          </div>
        </div>

        {/* Order History */}
        <div
          className="rounded-2xl h-64 lg:h-80"
          style={{ background: "#FAF8F6" }}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: "var(--phoenix-text-subtle)" }}
          >
            Order History
          </div>
        </div>
      </div>

      {/* ================= MIDDLE: Orderbook + Recent Trades ================= */}
      <div className="w-full lg:w-80 flex flex-col border-t lg:border-t-0 lg:border-l border-black/5">
        <div className="flex-1 p-2 min-h-[300px]">
          <Orderbook />
        </div>

        <div className="h-64 lg:h-80 p-2">
          <RecentTrades />
        </div>
      </div>

      {/* ================= RIGHT: Swap Interface ================= */}
      <div className="w-full lg:w-auto p-2 flex justify-center lg:justify-start">
        <SwappingInterface />
      </div>
    </div>
  );
}

export default Trading;
