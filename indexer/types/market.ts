// Market
export interface Market {
  baseMint: string;
  quoteMint: string;
  baseVault: string;
  quoteVault: string;
  bids: string;
  asks: string;
  eventQueue: string;
  baseLotSize: number;
  quoteLotSize: number;
  makerFeesBps: number;
  takerFeesBps: number;
  admin: string;
  vaultSignerNonce: number;
  marketStatus: number;
  minOrderSize: number;
  maxOrdersPerUser: number;
  padding: number[];
}

// Slab
export interface Slab {
  headIndex: number;
  freeListLen: number;
  leafCount: number;
  nodes: Node[];
}

export interface Node {
  price: number;
  quantity: number;
  owner: string;
  clientOrderId: number;
  timestamp: number;
  orderId: string;
  next: number;
  prev: number;
}

// Event Queue
export interface EventQueue {
  tail: number;
  header: number;
  count: number;
  events: Event[];
}

// Event (emitted)
export interface Event {
  orderId: number;         
  eventType: EventType;   
  price: number;            
  quantity: number;       
  maker: string;        
  taker: number;        
  timestamp: number;       
}

export enum EventType {
  NewOrder = 0,
  Fill = 1,
  Cancel = 2,
  PartialFill = 3,
}

// Open Orders
export interface OpenOrders {
  market: string;
  owner: string;
  baseFree: number;
  baseLocked: number;
  quoteFree: number;
  quoteLocked: number;
  orders: Order[];
  ordersCount: number;
}

export interface Order {
  orderType: OrderType;
  orderId: string;
  side: Side;
  price: number;
  quantity: number;
  clientOrderId: number;
}

export enum OrderType {
  Limit = 0,
  ImmediateOrCancel = 1,
  PostOnly = 2,
}

export enum Side {
  Bid = 0,
  Ask = 1,
}

// UI/Display types
export interface MarketState {
  market: string;
  bids: DisplayOrder[];
  asks: DisplayOrder[];
  lastUpdate: number;
}

export interface DisplayOrder {
  price: number;
  quantity: number;
  owner: string;
  orderId: string;
}