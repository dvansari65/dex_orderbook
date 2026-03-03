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

interface RecentTrade {
  price: number
  quantity: number
  side: 'bid' | 'ask'
  timestamp: string
}

const Trading = memo(() => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([])
  const socket = useSocket()
  const { publicKey } = useWallet()

  const fetchOrders = () => {
    if (!publicKey) return
    socket.emit("user-pubkey", publicKey)
    socket.on("order-history", (data: any) => setOrders(data))
  }

  useEffect(() => {
    fetchOrders()
    socket.on("order:filled", (trade: RecentTrade) => {
      setRecentTrades(prev => [trade, ...prev].slice(0, 20))
    })
    return () => {
      socket.off("order-history")
      socket.off("order:filled")
    }
  }, [socket, publicKey?.toString()])

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row lg:overflow-hidden bg-[var(--phoenix-bg-subtle)]">

      {/* ── LEFT: Chart + Tabbed Order History ── */}
      <div className="flex flex-col flex-1 p-2 gap-2 min-w-0 h-full">
        {/* Chart — 50% (decreased from 60%) */}
        <div className="card rounded-2xl overflow-hidden" style={{ flex: '0 0 50%' }}>
          <CandleChart />
        </div>

        {/* Tabbed Order History — 50% */}
        <div className="flex-1 min-h-0" style={{ flex: '0 0 calc(50% - 8px)' }}>
          <TabbedOrderHistory 
            recentTrades={recentTrades}
          />
        </div>
      </div>

      {/* ── MIDDLE: Orderbook (60%) + Recent Trades (40%) ── */}
      <div className="w-full lg:w-80 flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-light/5 h-full p-2">
        {/* Orderbook — 60% */}
        <div className="card rounded-2xl overflow-hidden" style={{ flex: '0 0 60%' }}>
          <Orderbook />
        </div>

        {/* Recent Trades — 40% */}
        <div className="card rounded-2xl overflow-hidden flex flex-col" style={{ flex: '0 0 calc(40% - 8px)' }}>
          <div className="px-4 py-2.5 border-b border-light bg-subtle shrink-0">
            <span className="text-xs font-bold tracking-wide text-primary">Recent Trades</span>
          </div>

          <div className="grid grid-cols-3 px-4 py-2 border-b border-light shrink-0">
            {['Price', 'Amount', 'Time'].map(col => (
              <span key={col} className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{col}</span>
            ))}
          </div>

          <div className="divide-light overflow-y-auto flex-1">
            {recentTrades?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-1.5 py-8">
                <span className="text-[11px] text-subtle">Waiting for trades...</span>
              </div>
            ) : recentTrades.map((trade, i) => (
              <div key={i} className="grid grid-cols-3 items-center px-4 py-2.5 hover:bg-subtle transition-colors duration-100">
                <span className={`text-[12px] font-semibold tabular-nums ${trade.side === 'bid' ? 'text-bid' : 'text-ask'}`}>
                  ${trade?.price?.toFixed(2)}
                </span>
                <span className="text-[11px] text-secondary tabular-nums">
                  {trade?.quantity?.toFixed(4)}
                </span>
                <span className="text-[10px] text-subtle">
                  {new Date(trade?.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Swap (reduced width) ── */}
      <div className="w-full lg:w-96 p-2 flex justify-center lg:justify-start h-full overflow-y-auto">
        <div className="w-full max-w-md">
          <SwappingInterface />
        </div>
      </div>
    </div>
  );
});

Trading.displayName = 'Trading';
export default Trading;