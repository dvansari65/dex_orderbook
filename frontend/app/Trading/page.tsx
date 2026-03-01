"use client"

import { memo, useEffect, useState } from "react";
import Orderbook from "@/components/orderbook";
import SwappingInterface from "@/components/swapping-interface";
import CandleChart from "@/components/CandleGraph";
import { useSocket } from "@/providers/SocketProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { Order } from "@/types/order";
import OrderRows from "@/components/orderbook-history";


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
    <div className="w-full h-screen flex flex-col lg:flex-row lg::overflow-hidden bg-[var(--phoenix-bg-subtle)]">

      {/* ── LEFT: Chart + Order History ── */}
      <div className="flex flex-col flex-1 p-2 gap-2 min-w-0 h-full">

        {/* Chart — 60% */}
        <div className="card rounded-2xl overflow-hidden" style={{ flex: '0 0 60%' }}>
          <CandleChart />
        </div>

        {/* Order History — 40% */}
        <div className="card rounded-2xl overflow-hidden flex flex-col" style={{ flex: '0 0 calc(40% - 8px)' }}>

          <div className="flex items-center justify-between px-4 py-2.5 border-b border-light bg-subtle shrink-0">
            <span className="text-xs font-bold tracking-wide text-primary">Order History</span>
            <button onClick={fetchOrders} className="btn-ghost flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-5 px-4 py-2 border-b border-light shrink-0">
            {['Side', 'Price', 'Amount', 'Filled', 'Status'].map(col => (
              <span key={col} className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{col}</span>
            ))}
          </div>

          <div className="divide-y divide-[var(--phoenix-border-light)] overflow-y-auto flex-1">
            <OrderRows orders={orders} />
          </div>

          <div className="px-4 py-2 border-t border-light bg-subtle flex justify-between items-center shrink-0">
            <span className="text-[10px] text-subtle">Last updated just now</span>
            <span className="text-[10px] text-subtle">{orders.length} orders</span>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Orderbook (60%) + Recent Trades (40%) ── */}
      <div className="w-full lg:w-72 flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-black/5 h-full p-2">

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
            { recentTrades && recentTrades?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-1.5">
                <span className="text-[11px] text-subtle">Waiting for trades...</span>
              </div>
            ) : recentTrades.map((trade, i) => (
              <div key={i} className="grid grid-cols-3 items-center px-4 py-2.5 hover:bg-subtle transition-colors duration-100">
                <span className={`text-[12px] font-semibold tabular-nums ${trade.side === 'bid' ? 'text-bid' : 'text-ask'}`}>
                  ${trade?.price?.toFixed(2)}
                </span>
                <span className="text-[11px] text-secondary tabular-nums">
                  {trade?.quantity?.toFixed(2)}
                </span>
                <span className="text-[10px] text-subtle">
                  {new Date(trade?.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Swap ── */}
      <div className="w-full lg:w-auto p-2 flex justify-center lg:justify-start h-full overflow-y-auto">
        <SwappingInterface />
      </div>
    </div>
  );
});

export default Trading;