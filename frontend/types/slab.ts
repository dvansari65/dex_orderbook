

// Market
export interface Market {
  baseMint: string;
  quoteMint: string;
  baseVault: string;
  quoteVault: string;
  bids: string;
  asks: string;
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
  nodes: Node[] | [];
}

export interface Node {
  price: number;
  quantity: number;
  owner: string;
  clientOrderId?: number;
  timestamp?: number;
  orderId: string;
  next?: number;
  prev?: number;
}

export interface Order {
  orderType: OrderType;
  orderId: string;
  side: Side;
  price: number;
  quantity: number;
  clientOrderId: number;
}

export type OrderType =
  | { limit: {} }
  | { immediateOrCancel: {} }
  | { postOnly: {} };

export type Side =
  | { bid: {} }
  | { ask: {} };

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

export interface PlaceOrderInputs {
  maxBaseSize: number,
  clientOrderId: number,
  price: number,
  orderType: OrderType,
  side: Side,
}

export interface OrderNode {
  price: any;
  quantity: number | undefined;
  owner: any;
  orderId: any;
}

export interface CandleSnapshot {
  open: number,
  close: number,
  high: number,
  low: number,
  time: number
}
