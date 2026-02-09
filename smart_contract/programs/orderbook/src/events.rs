use anchor_lang::prelude::*;
use crate::states::order_schema::enums::Side;

// Events for indexers
#[event]
#[derive(Debug)]
pub struct OrderPlacedEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub client_order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderFillEvent {
    pub maker: Pubkey,
    pub maker_order_id: u64,
    pub taker: Pubkey,
    pub taker_order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_filled: u64,
    pub base_lots_remaining: u64,
    pub timestamp: i64,
    pub market_pubkey: Pubkey
}

#[event]
pub struct OrderPartialFillEvent {
    pub maker: Pubkey,
    pub maker_order_id: u64,
    pub taker: Pubkey,
    pub taker_order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_filled: u64,
    pub base_lots_remaining: u64,
    pub timestamp: i64,
    pub market_pubkey: Pubkey
}

#[event]
pub struct OrderReducedEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_removed: u64,
    pub base_lots_remaining: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderCancelledEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderEvictedEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_evicted: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderExpiredEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub base_lots_removed: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeCollectedEvent {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub order_id: u64,
    pub fees_collected_in_quote_lots: u64,
    pub timestamp: i64,
}

#[event]
pub struct TimeInForceEvent {
    pub market: Pubkey,
    pub order_id: u64,
    pub last_valid_slot: u64,
    pub last_valid_unix_timestamp_in_seconds: u64,
}

// Helper functions for emitting events
// Helper function for emitting events
pub fn emit_order_placed(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    client_order_id: u64,
    side: Side,
    price: u64,
    base_lots: u64,
) -> Result<()> {  //  Changed to Result<()>
    msg!("EMITTING OrderPlacedEvent");
    msg!("Market: {}, Owner: {}", market, owner);
    msg!("OrderID: {}, Price: {}, Quantity: {}", order_id, price, base_lots);
    
    emit!(OrderPlacedEvent {
        market,
        owner,
        order_id,
        client_order_id,
        side,
        price,
        base_lots,
        timestamp: Clock::get()?.unix_timestamp,  // Use ? instead of unwrap
    });
    
    msg!("OrderPlacedEvent EMITTED");
    Ok(())  
}

pub fn emit_order_fill(
    maker: Pubkey,
    maker_order_id: u64,
    taker: Pubkey,
    taker_order_id: u64,
    side: Side,
    price: u64,
    base_lots_filled: u64,
    base_lots_remaining: u64,
    market_pubkey: &Pubkey
) ->Result<OrderFillEvent>{
    emit!(OrderFillEvent {
        maker,
        maker_order_id,
        taker,
        taker_order_id,
        side,
        price,
        base_lots_filled,
        base_lots_remaining,
        timestamp: Clock::get().unwrap().unix_timestamp,
        market_pubkey:*market_pubkey
    });
    msg!("fill order event emitted: market pub key:{} maker key:{}",market_pubkey,maker);
    Ok(OrderFillEvent {
        maker,
        maker_order_id,
        taker,
        taker_order_id,
        side,
        price,
        base_lots_filled,
        base_lots_remaining,
        timestamp: Clock::get().unwrap().unix_timestamp,
        market_pubkey:*market_pubkey
    })
}
pub fn emit_partial_fill_order (
    maker: Pubkey,
    maker_order_id: u64,
    taker: Pubkey,
    taker_order_id: u64,
    side: Side,
    price: u64,
    base_lots_filled: u64,
    base_lots_remaining: u64,
    market_pubkey: &Pubkey
)->Result<OrderPartialFillEvent> {
    emit!(OrderPartialFillEvent {
        maker,
        maker_order_id,
        taker,
        taker_order_id,
        side,
        price,
        base_lots_filled,
        base_lots_remaining,
        timestamp: Clock::get().unwrap().unix_timestamp,
        market_pubkey:*market_pubkey
    });
   msg!("partial fill order event emitted: market pub key:{} maker key:{}",market_pubkey,maker);
    Ok(OrderPartialFillEvent {
        maker,
        maker_order_id,
        taker,
        taker_order_id,
        side,
        price,
        base_lots_filled,
        base_lots_remaining,
        timestamp: Clock::get().unwrap().unix_timestamp,
        market_pubkey:*market_pubkey
    })
}

pub fn emit_order_cancelled(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    side: Side,
    price: u64,
) {
    emit!(OrderCancelledEvent {
        market,
        owner,
        order_id,
        side,
        price,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}

pub fn emit_order_reduced(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    side: Side,
    price: u64,
    base_lots_removed: u64,
    base_lots_remaining: u64,
) {
    emit!(OrderReducedEvent {
        market,
        owner,
        order_id,
        side,
        price,
        base_lots_removed,
        base_lots_remaining,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}

pub fn emit_order_evicted(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    side: Side,
    price: u64,
    base_lots_evicted: u64,
) {
    emit!(OrderEvictedEvent {
        market,
        owner,
        order_id,
        side,
        price,
        base_lots_evicted,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}

pub fn emit_order_expired(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    side: Side,
    price: u64,
    base_lots_removed: u64,
) {
    emit!(OrderExpiredEvent {
        market,
        owner,
        order_id,
        side,
        price,
        base_lots_removed,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}

pub fn emit_fee_collected(
    market: Pubkey,
    owner: Pubkey,
    order_id: u64,
    fees_collected_in_quote_lots: u64,
) {
    emit!(FeeCollectedEvent {
        market,
        owner,
        order_id,
        fees_collected_in_quote_lots,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}

pub fn emit_time_in_force(
    market: Pubkey,
    order_id: u64,
    last_valid_slot: u64,
    last_valid_unix_timestamp_in_seconds: u64,
) {
    emit!(TimeInForceEvent {
        market,
        order_id,
        last_valid_slot,
        last_valid_unix_timestamp_in_seconds,
    });
}