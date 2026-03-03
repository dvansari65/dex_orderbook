// components/TabbedOrderHistory.tsx
"use client"

import { memo, useState } from "react";
import { Order, ORDER_STATUS_MAP } from "@/types/order";
import OrderRows from "./orderbook-history";
import FillsTab from "./fills-tab";
import OpenOrdersTab from "./open-order-tab";
import { fetchOrderAccount } from "@/api/fetch-orders";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";

interface RecentTrade {
  price: number;
  quantity: number;
  side: 'bid' | 'ask';
  timestamp: string;
}

interface TabbedOrderHistoryProps {
  recentTrades: RecentTrade[];
}

const TabbedOrderHistory = memo(({ recentTrades }: TabbedOrderHistoryProps) => {
  const [activeTab, setActiveTab] = useState<'open' | 'fills' | 'history'>('open');
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  
  // Fetch order data directly in the component
  const { data: openOrderData, isLoading, refetch } = fetchOrderAccount(publicKey);

  // Transform the raw on-chain data to match Order interface
  const orders: Order[] = openOrderData?.orders?.map((rawOrder: any) => {
    // Map status from on-chain enum (1,2,3,4) to UI strings
    const status = ORDER_STATUS_MAP[rawOrder.orderStatus as keyof typeof ORDER_STATUS_MAP] || 'open';
    
    // Map side - assuming 0 = bid, 1 = ask (adjust if different)
    const side = rawOrder.side === 0 ? 'bid' : 'ask';

    return {
      orderId: rawOrder.orderId.toString(),
      side,
      price: Number(rawOrder.price) / 1e6, // Adjust decimals as needed
      quantity: Number(rawOrder.quantity) / 1e6, // Adjust decimals as needed
      filled: 0, // You'll need to calculate this from trade history or fills
      status,
      orderType: rawOrder.orderType, // Assuming this matches your OrderType enum
      owner: rawOrder.owner.toString(),
      clientOrderId: rawOrder.clientOrderId.toString(),
      placedAt: new Date().toISOString() // You might get this from elsewhere
    };
  }) || [];

  // Filter orders for open tab (active orders)
  const openOrders = orders.filter(
    (order) => order.status === 'open' || order.status === 'partial'
  );

  const getTabCount = () => {
    return {
      open: openOrders.length,
      fills: recentTrades.length,
      history: orders.length
    };
  };

  const counts = getTabCount();

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["open-order", publicKey] });
  };

  return (
    <div className="card rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-4 border-b border-light bg-subtle shrink-0">
        <div className="flex gap-1">
          {(['open', 'fills', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold tracking-wide capitalize transition-colors relative ${
                activeTab === tab 
                  ? 'text-primary' 
                  : 'text-subtle hover:text-secondary'
              }`}
            >
              {tab === 'open' ? 'Open Orders' : tab === 'fills' ? 'Fills' : 'Order History'}
              {counts[tab] > 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-subtle">
                  {counts[tab]}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
        
        <button 
          onClick={handleRefresh} 
          className="btn-ghost flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-5 px-4 py-2 border-b border-light shrink-0">
        {activeTab === 'fills' ? (
          ['Side', 'Price', 'Amount', 'Time', 'Status'].map(col => (
            <span key={col} className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{col}</span>
          ))
        ) : (
          ['Side', 'Price', 'Amount', 'Filled', 'Status'].map(col => (
            <span key={col} className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{col}</span>
          ))
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-light overflow-y-auto flex-1 min-h-[200px]">
        {activeTab === 'open' && <OpenOrdersTab orders={orders} />}
        {activeTab === 'fills' && <FillsTab fills={recentTrades} />}
        {activeTab === 'history' && <OrderRows orders={orders} isLoading={isLoading} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-light bg-subtle flex justify-between items-center shrink-0">
        <span className="text-[10px] text-subtle">Last updated just now</span>
        <span className="text-[10px] text-subtle">
          {counts[activeTab]} items
        </span>
      </div>
    </div>
  );
});

TabbedOrderHistory.displayName = 'TabbedOrderHistory';
export default TabbedOrderHistory;