use anchor_lang::prelude::*;
use crate::{
    error::MarketError,
    state::{EventQueue, EventType, FillRecord, Market, QueueEvent},
    states::order_schema::enums::Side,
};

// ─────────────────────────────────────────────────────────────
// #[event] structs — indexer listens to these via Anchor logs.
// Field names are part of the indexer ABI — do not rename them.
// ─────────────────────────────────────────────────────────────

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
    pub market_pubkey: Pubkey,
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
    pub market_pubkey: Pubkey,
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

// ─────────────────────────────────────────────────────────────
// EventParams — input to dispatch_event().
// maker_order_id and maker_remaining_qty are zero for
// non-fill events (Place / Cancel / Reduce / Evict / Expire).
// ─────────────────────────────────────────────────────────────
pub struct EventParams {
    pub event_type: EventType,
    pub order_id: u64,
    pub owner: Pubkey,
    pub counterparty: Pubkey,
    pub side: Side,
    pub price: u64,
    pub base_quantity: u64,
    pub client_order_id: u64,
    pub market_pubkey: Pubkey,
    // Fill-specific — populate from FillRecord, zero otherwise
    pub maker_order_id: u64,
    pub maker_remaining_qty: u64,
    pub taker_remaining_qty: u64
}

impl EventParams {
    // Shortcut constructor for non-fill events.
    // Saves writing maker_order_id: 0, maker_remaining_qty: 0 everywhere.
    pub fn non_fill(
        event_type: EventType,
        order_id: u64,
        owner: Pubkey,
        side: Side,
        price: u64,
        base_quantity: u64,
        client_order_id: u64,
        market_pubkey: Pubkey,
    ) -> Self {
        Self {
            event_type,
            order_id,
            owner,
            counterparty: Pubkey::default(),
            side,
            price,
            base_quantity,
            client_order_id,
            market_pubkey,
            maker_order_id: 0,
            maker_remaining_qty: 0,
            taker_remaining_qty:0
        }
    }
}

// ─────────────────────────────────────────────────────────────
// dispatch_event
//
// THE ONLY function that calls emit!() and insert_event().
// Never call those directly anywhere else in the codebase.
//
// Three things happen atomically per call:
//   1. market.global_seq incremented  — ordering guarantee for indexer
//   2. Rich #[event] emitted          — fast path (Anchor logs / websocket)
//   3. QueueEvent inserted            — durable on-chain ring buffer
// ─────────────────────────────────────────────────────────────
pub fn dispatch_event(
    market: &mut Market,
    event_queue: &mut EventQueue,
    params: EventParams,
) -> Result<()> {
    // 1. Increment global sequence
    let seq = market
        .global_seq
        .checked_add(1)
        .ok_or(MarketError::SeqOverflow)?;
    
    market.global_seq = seq;

    let clock = Clock::get()?;

    // 2. Emit specific rich event struct
    match params.event_type {
        EventType::Place => {
            emit!(OrderPlacedEvent {
                market: params.market_pubkey,
                owner: params.owner,
                order_id: params.order_id,
                client_order_id: params.client_order_id,
                side: params.side,
                price: params.price,
                base_lots: params.base_quantity,
                timestamp: clock.unix_timestamp,
            });
        }

        EventType::Fill => {
            emit!(OrderFillEvent {
                maker: params.counterparty,
                maker_order_id: params.maker_order_id,
                taker: params.owner,
                taker_order_id: params.order_id,
                side: params.side,
                price: params.price,
                base_lots_filled: params.base_quantity,
                base_lots_remaining: params.maker_remaining_qty,
                timestamp: clock.unix_timestamp,
                market_pubkey: params.market_pubkey,
            });
        }

        EventType::PartialFill => {
            emit!(OrderPartialFillEvent {
                maker: params.counterparty,
                maker_order_id: params.maker_order_id,
                taker: params.owner,
                taker_order_id: params.order_id,
                side: params.side,
                price: params.price,
                base_lots_filled: params.base_quantity,
                base_lots_remaining: params.maker_remaining_qty,
                timestamp: clock.unix_timestamp,
                market_pubkey: params.market_pubkey,
            });
        }

        EventType::Cancel => {
            emit!(OrderCancelledEvent {
                market: params.market_pubkey,
                owner: params.owner,
                order_id: params.order_id,
                side: params.side,
                price: params.price,
                timestamp: clock.unix_timestamp,
            });
        }

        EventType::Reduce => {
            emit!(OrderReducedEvent {
                market: params.market_pubkey,
                owner: params.owner,
                order_id: params.order_id,
                side: params.side,
                price: params.price,
                base_lots_removed: params.base_quantity,
                base_lots_remaining: params.maker_remaining_qty,
                timestamp: clock.unix_timestamp,
            });
        }

        EventType::Evict => {
            emit!(OrderEvictedEvent {
                market: params.market_pubkey,
                owner: params.owner,
                order_id: params.order_id,
                side: params.side,
                price: params.price,
                base_lots_evicted: params.base_quantity,
                timestamp: clock.unix_timestamp,
            });
        }

        EventType::Expire => {
            emit!(OrderExpiredEvent {
                market: params.market_pubkey,
                owner: params.owner,
                order_id: params.order_id,
                side: params.side,
                price: params.price,
                base_lots_removed: params.base_quantity,
                timestamp: clock.unix_timestamp,
            });
        }

        EventType::FeeCollected => {
            // Implement when fee pipeline is wired.
            // Needs fees_collected_in_quote_lots added to EventParams.
        }

        EventType::TimeInForce => {
            // Implement when TIF orders are added.
            // Needs last_valid_slot + last_valid_unix_timestamp_in_seconds.
        }
    }

    let is_valid_event = 
                            params.event_type == EventType::Cancel || 
                            params.event_type == EventType::PartialFill || 
                            params.event_type == EventType::Fill ;

    if is_valid_event {
        let event = QueueEvent {
            global_seq: seq,
            maker_order_id: params.maker_order_id,
            event_type: params.event_type,
            order_id: params.order_id,
            owner: params.owner,
            counterparty: params.counterparty,
            side: params.side,
            price: params.price,
            base_quantity: params.base_quantity,
            client_order_id: params.client_order_id,
            timestamp: clock.unix_timestamp,
            market_pubkey: params.market_pubkey,
            maker_remaining_qty:params.maker_remaining_qty,
            taker_remaining_qty:params.taker_remaining_qty
        };
        event_queue.insert_event(event)?;
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────
// dispatch_fill_event
//
// Convenience wrapper for fills only.
// Pulls maker_order_id and maker_remaining_qty from FillRecord
// so call sites don't have to manually build EventParams.
// ─────────────────────────────────────────────────────────────
pub fn dispatch_fill_event(
    market: &mut Market,
    event_queue: &mut EventQueue,
    fill: &FillRecord,
    taker_order_id: u64,
    taker_owner: Pubkey,
    taker_client_order_id: u64,
    taker_side: Side,
    market_pubkey: Pubkey,
) -> Result<()> {
    dispatch_event(
        market,
        event_queue,
        EventParams {
            event_type: if fill.maker_fully_filled {
                EventType::Fill
            } else {
                EventType::PartialFill
            },
            order_id: taker_order_id,
            owner: taker_owner,
            counterparty: fill.maker_owner,
            side: taker_side,
            price: fill.execution_price,
            base_quantity: fill.fill_qty,
            client_order_id: taker_client_order_id,
            market_pubkey,
            maker_order_id: fill.maker_order_id,
            maker_remaining_qty: fill.maker_remaining_qty,
            taker_remaining_qty:0
        },
    )
}
