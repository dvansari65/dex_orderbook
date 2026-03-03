// components/open-order-tab.tsx
"use client"

import { memo } from "react";
import { Order } from "@/types/order";
import OrderRows from "./orderbook-history";

interface OpenOrdersTabProps {
  orders: Order[];
}

const OpenOrdersTab = memo(({ orders }: OpenOrdersTabProps) => {
  // Filter for open and partial orders (active orders)
  const openOrders = orders.filter(
    (order) => order.status === 'open' || order.status === 'partial'
  );

  return <OrderRows orders={openOrders} />;
});

OpenOrdersTab.displayName = 'OpenOrdersTab';
export default OpenOrdersTab;