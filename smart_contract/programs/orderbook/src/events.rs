use anchor_lang::prelude::*;

use crate::states::order_schema::enums::Side;
 
#[event]
pub struct OrderPlacedEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub client_order_id: u64,
    pub side: Side,
    pub price: u64,
    /// Base lots placed on book
    pub base_lots: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderFillEvent {
    /// Maker (liquidity provider)
    pub maker: Pubkey,
    pub maker_order_id: u64,
    /// Taker (liquidity remover)
    pub taker: Pubkey,
    pub side: Side,
    pub price: u64,
    /// Filled in this match
    pub base_lots_filled: u64,
    /// Remaining on maker order
    pub base_lots_remaining: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderReducedEvent {
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    /// Lots removed
    pub base_lots_removed: u64,
    /// Remaining after reduce
    pub base_lots_remaining: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderCancelledEvent {
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub timestamp: i64,
}

// -------------------- SPECIAL EVENTS -------------------- //

#[event]
pub struct OrderEvictedEvent {
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_evicted: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderExpiredEvent {
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_removed: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeCollectedEvent {
    pub owner: Pubkey,
    pub order_id: u64,
    pub fees_collected_in_quote_lots: u64,
    pub timestamp: i64,
}

#[event]
pub struct TimeInForceEvent {
    pub order_id: u64,
    pub last_valid_slot: u64,
    pub last_valid_unix_timestamp_in_seconds: u64,
}
