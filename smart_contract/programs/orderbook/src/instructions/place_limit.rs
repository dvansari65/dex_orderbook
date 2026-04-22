use crate::{
    assets::{lock_ask_funds, lock_bid_funds},
    error::MarketError,
    events::{dispatch_event, dispatch_fill_event, EventParams},
    helpers::{get_next_order_id, try_match, update_trader_entry},
    *,
};
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<PlaceLimitOrder>,
    max_base_size: u64,
    client_order_id: u64,
    price: u64,
    order_type: OrderType,
    side: Side,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let owner = &mut ctx.accounts.owner;
    let asks = &mut ctx.accounts.asks;
    let bids = &mut ctx.accounts.bids;

    require!(market.market_status == 1, MarketError::MarketActiveError);
    require!(
        max_base_size >= market.base_lot_size,
        MarketError::MarketOrderSizeError
    );

    let base_lot_size = market.base_lot_size;
    let quote_lot_size = market.quote_lot_size;
    let market_key = market.key();
    let order_id = get_next_order_id(market)?;

    let base_lots = max_base_size / base_lot_size;

    let quote_lots = price
        .checked_div(quote_lot_size)
        .ok_or(MarketError::UnderFlow)?;

    match side {
        Side::Bid => lock_bid_funds(
            market,
            &owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.user_quote_vault,
            &ctx.accounts.quote_vault,
            &ctx.accounts.token_program,
            quote_lots,
            base_lots,
        )?,
        Side::Ask => lock_ask_funds(
            market,
            &owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.base_vault,
            &ctx.accounts.token_program,
            base_lots,
        )?,
    };

    dispatch_event(
        market,
        EventParams::non_fill(
            EventType::Place,
            order_id,
            owner.key(),
            side,
            quote_lots,
            base_lots,
            client_order_id,
            market_key,
        ),
    )?;

    let (opposite_slab, same_slab) = match side {
        Side::Ask => (bids, asks),
        Side::Bid => (asks, bids),
    };

    let fills = try_match(side, base_lots, quote_lots, opposite_slab)?;

    if fills.is_empty() {
        same_slab.insert_order(
            order_id,
            &order_type,
            base_lots,
            owner.key(),
            quote_lots,
            OrderStatus::Open,
            client_order_id,
            &market_key,
            side,
        )?;
    } else {
        for fill in fills.iter() {
            let maker_entry = market.get_trader_entry(&fill.maker_owner);
            update_trader_entry(true, side, fill, maker_entry)?;

            let taker_entry = market.get_trader_entry(&owner.key());
            update_trader_entry(false, side, fill, taker_entry)?;

            dispatch_fill_event(
                market,
                fill,
                order_id,
                owner.key(),
                client_order_id,
                side,
                market_key,
            )?;

            let remaining_qty = base_lots - fill.fill_qty;

            if remaining_qty > 0 {
                same_slab.insert_order(
                    order_id,
                    &order_type,
                    remaining_qty,
                    owner.key(),
                    quote_lots,
                    OrderStatus::PartialFill,
                    client_order_id,
                    &market_key,
                    side,
                )?;
            }
        }
    }

    Ok(())
}
