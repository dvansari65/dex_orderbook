use crate::{
    assets::{lock_ask_funds, lock_bid_funds},
    error::{MarketError, OrderError, TraderEntryError},
    helpers::{get_next_order_id, try_match_ioc, update_trader_entry},
    *,
};
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<PlaceIOCOrder>,
    base_qty: u64,
    price: u64,
    order_type: OrderType,
    client_order_id: u64,
    side: Side,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let owner = &mut ctx.accounts.owner;

    require!(market.market_status == 1, MarketError::MarketActiveError);
    require!(
        order_type == OrderType::ImmediateOrCancel,
        OrderError::InvalidOrderType
    );
    require!(
        base_qty >= market.min_order_size,
        MarketError::MarketOrderSizeError
    );

    let market_key = market.key();
    let order_id = get_next_order_id(market)?;

    let base_lots = base_qty / market.base_lot_size;
    let quote_lots = price
        .checked_div(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    let taker_index = market
        .get_trader_index(&owner.key())
        .ok_or(TraderEntryError::EntryNotFound)?;

    match side {
        Side::Bid => lock_bid_funds(
            market,
            owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.user_quote_vault,
            &ctx.accounts.quote_vault,
            &ctx.accounts.token_program,
            quote_lots,
            base_lots,
        )?,
        Side::Ask => lock_ask_funds(
            market,
            owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.base_vault,
            &ctx.accounts.token_program,
            base_lots,
        )?,
    };

    let opposite_slab = match side {
        Side::Ask => &mut ctx.accounts.bids,
        Side::Bid => &mut ctx.accounts.asks,
    };

    let fill_opt = try_match_ioc(side, quote_lots, base_lots, opposite_slab)?;

    if let Some(fill) = fill_opt {
        let maker_entry = market.get_trader_entry(&fill.maker_owner);
        update_trader_entry(true, side, &fill, maker_entry)?;

        let taker_entry = market.trader_entry.get_mut(taker_index);
        update_trader_entry(false, side, &fill, taker_entry)?;
    }

    Ok(())
}
