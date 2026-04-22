use crate::{assets::{lock_ask_funds, lock_bid_funds}, error::{MarketError, OrderError}, helpers::{get_next_order_id, would_match_post_only}, *};
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<PlacePostOnlyOrder>,
    base_qty: u64,
    price: u64,
    order_type: OrderType,
    client_order_id: u64,
    side: Side,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    require!(market.market_status == 1, MarketError::MarketActiveError);
    require!(
        order_type == OrderType::PostOnly,
        OrderError::InvalidOrderType
    );

    let order_id = get_next_order_id(market)?;
    let base_lots = base_qty / market.base_lot_size;
    let quote_lots = price
        .checked_div(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    if would_match_post_only(side, quote_lots, &ctx.accounts.asks, &ctx.accounts.bids) {
        return Err(OrderError::WouldMatchImmediately.into());
    }

    match side {
        Side::Bid => lock_bid_funds(
            market,
            &ctx.accounts.owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.user_quote_vault,
            &ctx.accounts.quote_vault,
            &ctx.accounts.token_program,
            quote_lots,
            base_lots,
        )?,
        Side::Ask => lock_ask_funds(
            market,
            &ctx.accounts.owner,
            &ctx.accounts.user_base_vault,
            &ctx.accounts.base_vault,
            &ctx.accounts.token_program,
            base_lots,
        )?,
    };

    let slab = match side {
        Side::Ask => &mut ctx.accounts.asks,
        Side::Bid => &mut ctx.accounts.bids,
    };

    slab.insert_order(
        order_id,
        &order_type,
        base_lots,
        ctx.accounts.owner.key(),
        quote_lots,
        OrderStatus::Open,
        client_order_id,
        &market.key(),
        side,
    )?;

    Ok(())
}
