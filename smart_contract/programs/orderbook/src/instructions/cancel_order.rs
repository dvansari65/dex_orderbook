use crate::{assets::{unlock_ask_funds, unlock_bid_funds}, events::{EventParams, dispatch_event}, *};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<CancelOrder>, order_id: u64, side: Side) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let owner = &mut ctx.accounts.owner;
    let user_base_vault = &mut ctx.accounts.user_base_vault;
    let user_quote_vault = &mut ctx.accounts.user_quote_vault;
    let market_key = market.key();

    let slab = match side {
        Side::Ask => &mut ctx.accounts.asks,
        Side::Bid => &mut ctx.accounts.bids,
    };

    let deleted_order = slab.remove_order(&order_id)?;

    match side {
        Side::Ask => unlock_ask_funds(
            market,
            deleted_order.quantity,
            &owner.key(),
            &user_base_vault,
        )?,
        Side::Bid => unlock_bid_funds(
            market,
            deleted_order.price,
            &owner.key(),
            deleted_order.quantity,
            user_quote_vault,
        )?,
    };

    dispatch_event(
        market,
        EventParams {
            event_type: EventType::Cancel,
            order_id: order_id,
            owner: owner.key(),
            counterparty: Pubkey::default(), // cancel mein koi counterparty nahi
            side: side,
            price: deleted_order.price,            // quote lots
            base_quantity: deleted_order.quantity, // base lots
            client_order_id: deleted_order.client_order_id,
            market_pubkey: market_key,
            maker_order_id: 0,      // cancel mein maker nahi hota
            maker_remaining_qty: 0, // cancel mein maker nahi hota
            taker_remaining_qty: 0, // yahi wapas karana hai
        },
    )?;

    Ok(())
}
