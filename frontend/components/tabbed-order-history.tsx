// components/TabbedOrderHistory.tsx
"use client"

import { memo, useState } from "react";
import { Order } from "@/types/order";
import OrderRows from "./orderbook-history";
import FillsTab from "./fills-tab";
import OpenOrdersTab from "./open-order-tab";

interface RecentTrade {
  price: number;
  quantity: number;
  side: 'bid' | 'ask';
  timestamp: string;
}

interface TabbedOrderHistoryProps {
  orders: Order[];
  recentTrades: RecentTrade[];
  onRefresh?: () => void;
}

/* ── column definitions per tab ── */
const COLUMNS: Record<string, string[]> = {
  open:    ['Side', 'Price', 'Amount', 'Filled', 'Status'],
  fills:   ['Side', 'Price', 'Amount', 'Time',   'Status'],
  history: ['Side', 'Price', 'Amount', 'Filled', 'Status'],
};

const TAB_LABELS: Record<string, string> = {
  open:    'Open Orders',
  fills:   'Fills',
  history: 'Order History',
};

const TabbedOrderHistory = memo(({ orders, recentTrades, onRefresh }: TabbedOrderHistoryProps) => {
  const [activeTab, setActiveTab] = useState<'open' | 'fills' | 'history'>('open');

  const openOrders = orders.filter(
    (order) => order.status === 'open' || order.status === 'partial'
  );

  const counts = {
    open:    openOrders.length,
    fills:   recentTrades.length,
    history: orders.length,
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  return (
    <div className="w-full h-full rounded-2xl bg-[#FAF8F6] flex flex-col overflow-hidden">

      {/* ── Header: title + refresh (mirrors orderbook's px-3 py-2 header) ── */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-[var(--phoenix-text-primary)]">
          Order History
        </span>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-[10px] font-medium text-[var(--phoenix-text-subtle)] hover:text-[var(--phoenix-text-primary)] transition-colors"
        >
          <svg
            width="9" height="9"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Tabs (same px-3 rhythm, text-[10px] scale) ── */}
      <div className="flex items-center px-3 gap-3 bg-[var(--phoenix-bg-main)]">
        {(['open', 'fills', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              relative py-1.5 text-[10px] font-semibold tracking-wide transition-colors
              ${activeTab === tab
                ? 'text-[var(--phoenix-text-primary)]'
                : 'text-[var(--phoenix-text-subtle)] hover:text-[var(--phoenix-text-primary)]'
              }
            `}
          >
            {TAB_LABELS[tab]}
            {counts[tab] > 0 && (
              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded-full bg-[var(--phoenix-bg-main)] text-[var(--phoenix-text-subtle)]">
                {counts[tab]}
              </span>
            )}
            {/* active underline — same weight as spread bar */}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[var(--phoenix-text-primary)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Column headers (mirrors orderbook's column header row exactly) ── */}
      <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[10px] font-medium text-[var(--phoenix-text-subtle)]">
        {COLUMNS[activeTab].map((col) => (
          <div key={col} className={col !== 'Side' ? 'text-right' : ''}>
            {col}
          </div>
        ))}
      </div>

      {/* ── Content rows ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'open'    && <OpenOrdersTab orders={openOrders} />}
        {activeTab === 'fills'   && <FillsTab fills={recentTrades} />}
        {activeTab === 'history' && <OrderRows orders={orders} />}
      </div>

      {/* ── Footer (same px-3 py-1 + phoenix-bg-main as spread bar) ── */}
      <div className="px-3 py-1 bg-[var(--phoenix-bg-main)] text-[10px] text-[var(--phoenix-text-subtle)] flex justify-between">
        <span>Last updated just now</span>
        <span>{counts[activeTab]} items</span>
      </div>

    </div>
  );
});

TabbedOrderHistory.displayName = 'TabbedOrderHistory';
export default TabbedOrderHistory;
