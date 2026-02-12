// types/events.ts
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export enum Side {
  Bid = "bid",
  Ask = "ask",
}


export interface OrderPlacedEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  clientOrderId: BN;
  side: Side;
  price: BN;
  baseLots: BN;
  timestamp: BN;
}

export interface OrderFillEvent {
  maker: PublicKey;
  makerOrderId: BN;
  taker: PublicKey;
  takerOrderId: BN;
  side: Side;
  price: BN;
  baseLotsFilled: BN;
  baseLotsRemaining: BN;
  timestamp: BN;
  marketPubkey:PublicKey
}

export interface OrderPartialFillEvent {
  maker: PublicKey;
  makerOrderId: BN;
  taker: PublicKey;
  takerOrderId: BN;
  side: Side;
  price: BN;
  baseLotsFilled: BN;
  baseLotsRemaining: BN;
  timestamp: BN;
  marketPubkey:PublicKey
}

export interface OrderFillEventData {
  maker:string,
  makerOrderId: number;
  taker: number;
  takerOrderId: number;
  side: "ask" | "bid";
  price: number;
  baseLotsFilled: number;
  baseLotsRemaining: number;
  timestamp: number;
}

export interface OrderReducedEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  side: Side;
  price: BN;
  baseLotsRemoved: BN;
  baseLotsRemaining: BN;
  timestamp: BN;
}

export interface OrderCancelledEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  side: Side;
  price: BN;
  timestamp: BN;
}

export interface OrderEvictedEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  side: Side;
  price: BN;
  baseLotsEvicted: BN;
  timestamp: BN;
}

export interface OrderExpiredEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  side: Side;
  price: BN;
  baseLotsRemoved: BN;
  timestamp: BN;
}

export interface FeeCollectedEvent {
  market: PublicKey;
  owner: PublicKey;
  orderId: BN;
  feesCollectedInQuoteLots: BN;
  timestamp: BN;
}

export interface TimeInForceEvent {
  market: PublicKey;
  orderId: BN;
  lastValidSlot: BN;
  lastValidUnixTimestampInSeconds: BN;
}

export interface FillEvent {
  signature:string,
  maker: PublicKey;
  makerOrderId: BN;
  taker: PublicKey;
  takerOrderId: BN;
  side: Side;
  price: BN;
  baseLotsFilled: BN;
  baseLotsRemaining: BN;
  timestamp: BN;
  marketPubkey:PublicKey
}

export interface convertEventOutput {
  price:number,      // price
  side: Side,   // quantity
  quantity: number,       // side (bid/ask) - REQUIRED
  timestamp: number,
  orderId:number
}