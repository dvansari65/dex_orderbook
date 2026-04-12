// app/trading/page.tsx
"use client"

import { memo, useEffect, useState } from "react";
import Orderbook from "@/components/orderbook";
import SwappingInterface from "@/components/swapping-interface";
import CandleChart from "@/components/CandleGraph";
import { useSocket } from "@/providers/SocketProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { Order } from "@/types/order";
import TabbedOrderHistory from "@/components/tabbed-order-history";
import TradingNavbar from "@/components/trading-navbar";

interface RecentTrade {
  price: number
  quantity: number
  side: 'bid' | 'ask'
  timestamp: string
}

const normalizeOrderStatus = (status: unknown): Order["status"] => {
  switch (String(status).toLowerCase()) {
    case "partial":
      return "partial";
    case "filled":
      return "filled";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "open";
  }
};

const Trading = memo(() => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([])
  const socket = useSocket()
  const { publicKey } = useWallet()

  const fetchOrders = () => {
    if (!publicKey) return
    socket.emit("user-pubkey", publicKey.toBase58())
  }

  useEffect(() => {
    if (!publicKey) {
      setOrders([]);
      return;
    }

    const handleOrderHistory = (data: any[]) => {
      const nextOrders = Array.isArray(data)
        ? data.map((item) => ({
            orderId: String(item.orderId),
            side: (item.side === "ask" ? "ask" : "bid") as Order["side"],
            price: Number(item.price ?? 0),
            quantity: Number(item.quantity ?? 0),
            filled: Number(item.filled ?? 0),
            status: normalizeOrderStatus(item.status),
            placedAt: item.placedAt,
            clientOrderId: undefined,
            orderType: undefined,
            owner: undefined,
          }))
        : [];

      setOrders(nextOrders);
    };

    fetchOrders()
    socket.on("order-history", handleOrderHistory)
    socket.on("order:filled", (trade: RecentTrade) => {
      setRecentTrades(prev => [trade, ...prev].slice(0, 20))
    })
    return () => {
      socket.off("order-history", handleOrderHistory)
      socket.off("order:filled")
    }
  }, [socket, publicKey?.toString()])

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--phoenix-bg-subtle)]">
      <TradingNavbar />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:flex-row lg:overflow-hidden">

        {/* ── LEFT: Chart + Tabbed Order History ── */}
        <div className="flex h-full min-w-0 flex-1 flex-col gap-2">

          {/* Chart */}
          <div className="overflow-hidden rounded-2xl bg-[var(--phoenix-bg-main)]" style={{ flex: '0 0 55%' }}>
            <CandleChart />
          </div>

          {/* Tabbed Order History */}
          <div className="min-h-0" style={{ flex: '0 0 calc(45% - 4px)' }}>
            <TabbedOrderHistory orders={orders} recentTrades={recentTrades} onRefresh={fetchOrders} />
          </div>

        </div>

        {/* ── MIDDLE: Orderbook + Recent Trades ── */}
        <div className="flex h-full w-full flex-col gap-2 lg:w-60">

          {/* Orderbook */}
          <div className="overflow-hidden rounded-2xl" style={{ flex: '0 0 60%' }}>
            <Orderbook />
          </div>

          {/* Recent Trades */}
          <div
            className="flex flex-col overflow-hidden rounded-2xl bg-[var(--phoenix-bg-main)]"
            style={{ flex: '0 0 calc(40% - 4px)' }}
          >
            {/* Header */}
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-[var(--phoenix-text-primary)]">
                Recent Trades
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] font-medium text-[var(--phoenix-text-subtle)]">
              <div>Price</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Time</div>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto flex-1">
              {recentTrades?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <span className="text-[10px] text-[var(--phoenix-text-subtle)]">
                    Waiting for trades...
                  </span>
                </div>
              ) : recentTrades.map((trade, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 items-center px-3 py-1"
                >
                  <span className={`text-[10px] font-semibold tabular-nums ${
                    trade.side === 'bid'
                      ? 'text-[var(--phoenix-bid)]'
                      : 'text-[var(--phoenix-ask)]'
                  }`}>
                    ${trade?.price?.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[var(--phoenix-text-subtle)] tabular-nums text-right">
                    {trade?.quantity?.toFixed(3)}
                  </span>
                  <span className="text-[10px] text-[var(--phoenix-text-subtle)] text-right">
                    {new Date(trade?.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT: Swap ── */}
        <div className="flex h-full w-full justify-center overflow-y-auto lg:w-72 lg:justify-start">
          <div className="w-full max-w-sm">
            <SwappingInterface />
          </div>
        </div>

      </div>
    </div>
  );
});

Trading.displayName = 'Trading';
export default Trading;