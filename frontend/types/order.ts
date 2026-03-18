// types/order.ts
import { OrderType } from "./slab";

/**
 * On-chain OrderStatus enum matching your Rust backend
 * #[repr(u8)]
 * pub enum OrderStatus {
 *     Fill = 1,
 *     PartialFill = 2,
 *     Open = 3,
 *     Cancel = 4
 * }
 */
export enum OrderStatus {
  Fill = 1,
  PartialFill = 2,
  Open = 3,
  Cancel = 4
}

/**
 * UI-friendly order status strings
 */
export type OrderStatusUI = 'open' | 'partial' | 'filled' | 'cancelled';

/**
 * Status mapping from on-chain enum to UI strings
 */
export const ORDER_STATUS_MAP: Record<OrderStatus, OrderStatusUI> = {
  [OrderStatus.Fill]: 'filled',
  [OrderStatus.PartialFill]: 'partial',
  [OrderStatus.Open]: 'open',
  [OrderStatus.Cancel]: 'cancelled'
};

/**
 * Main Order interface for UI - SINGLE DEFINITION
 */
export interface Order {
  orderId: string;
  side: 'bid' | 'ask';
  price: number;
  quantity: number;
  filled: number; // Amount filled so far
  status: OrderStatusUI; // UI-friendly status
  orderType: OrderType;
  owner: string;
  clientOrderId: string;
  placedAt?: string; // Optional - you mentioned this exists
}

/**
 * Raw on-chain order type (matches your Rust struct exactly)
 */
export interface RawOrder {
  orderType: OrderType;
  orderId: string; // Converted from u64
  side: number; // 0 for bid, 1 for ask (based on your Side enum)
  price: string; // Converted from u64
  owner: string; // Converted from Pubkey
  quantity: string; // Converted from u64
  clientOrderId: string; // Converted from u64
  orderStatus: OrderStatus; // 1,2,3,4
}

/**
 * Raw open orders account (matches your Rust OpenOrders struct)
 */
export interface RawOpenOrders {
  market: string; // Pubkey as string
  owner: string; // Pubkey as string
  baseFree: string; // u64 as string
  baseLocked: string; // u64 as string
  quoteFree: string; // u64 as string
  quoteLocked: string; // u64 as string
  orders: RawOrder[];
  ordersCount: number;
}