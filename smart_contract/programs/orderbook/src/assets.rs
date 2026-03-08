use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

use crate::{
    error::{MarketError, OpenOrderError},
    state::{FillRecord, Market, OpenOrders}, states::order_schema::enums::Side,
};

pub fn transfer_from_user<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
    )
}

pub fn transfer_from_vault<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    vault_signer: &AccountInfo<'info>,
    seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: vault_signer.to_account_info(),
            },
            seeds,
        ),
        amount,
    )
}

pub fn lock_bid_funds<'info>(
    market: &Market,
    owner: &Signer<'info>,
    user_quote_vault: &Account<'info, TokenAccount>,
    quote_vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    open_order: &mut Account<'info, OpenOrders>,
    quote_lots: u64,
    base_lots: u64,
) -> Result<u64> {
    let amount_to_lock = quote_lots
        .checked_mul(base_lots)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    require!(
        user_quote_vault.amount >= amount_to_lock,
        MarketError::InsufficientBaseBalance
    );
    msg!("balance of user:{}", user_quote_vault.amount);

    transfer_from_user(
        token_program,
        user_quote_vault,
        quote_vault,
        owner,
        amount_to_lock,
    )?;

    msg!("Transfer successful");

    open_order.quote_locked = open_order
        .quote_locked
        .checked_add(amount_to_lock)
        .ok_or(MarketError::MathOverflow)?;
    Ok(amount_to_lock)
}

pub fn lock_ask_funds<'info>(
    market: &Market,
    owner: &Signer<'info>,
    user_base_vault: &Account<'info, TokenAccount>,
    base_vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    open_order: &mut Account<'info, OpenOrders>,
    base_lots: u64,
) -> Result<u64> {
    let amount_to_lock = base_lots
        .checked_mul(market.base_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    require!(
        user_base_vault.amount >= amount_to_lock,
        MarketError::InsufficientBaseBalance
    );
    transfer_from_user(
        token_program,
        user_base_vault,
        base_vault,
        owner,
        amount_to_lock,
    )?;

    open_order.base_locked = open_order
        .base_locked
        .checked_add(amount_to_lock)
        .ok_or(MarketError::MathOverflow)?;

    Ok(amount_to_lock)
}

pub fn unlock_bid_funds<'info>(
    market: &Market,
    open_order: &mut Account<'_, OpenOrders>,
    quote_lots: u64,
    taker_qty: u64,
) -> Result<u64> {
    let amount_to_move = quote_lots
        .checked_mul(taker_qty)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    require!(amount_to_move > 0, MarketError::InvalidPrice);

    open_order.quote_locked = open_order
        .quote_locked
        .checked_sub(amount_to_move)
        .ok_or(OpenOrderError::UnderFlow)?;

    open_order.quote_free = open_order
        .quote_free
        .checked_add(amount_to_move)
        .ok_or(OpenOrderError::OverFlow)?;

    Ok(amount_to_move)
}

pub fn unlock_ask_funds<'info>(
    market: &Market,
    open_order: &mut Account<'_, OpenOrders>,
    taker_qty: u64,
) -> Result<u64> {
    let amount_to_move = taker_qty
        .checked_mul(market.base_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    require!(amount_to_move > 0, MarketError::InvalidBaseQty);

    open_order.base_locked = open_order
        .base_locked
        .checked_sub(amount_to_move)
        .ok_or(OpenOrderError::UnderFlow)?;

    open_order.base_free = open_order
        .base_free
        .checked_add(amount_to_move)
        .ok_or(OpenOrderError::OverFlow)?;

    Ok(amount_to_move)
}

pub fn credit_fill(
    taker_open_order: &mut OpenOrders,
    maker_open_order: &mut OpenOrders,
    fill: &FillRecord,
    taker_side: Side,
    market: &Market,
) -> Result<()> {
    // quote value of this fill in raw token units (lots × lot_size)
    let quote_amount = fill
        .fill_qty
        .checked_mul(fill.execution_price)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    let base_amount = fill
        .fill_qty
        .checked_mul(market.base_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    match taker_side {
        Side::Ask => {
            // Taker sold base → receives quote
            taker_open_order.base_locked = taker_open_order
                .base_locked
                .checked_sub(base_amount)
                .ok_or(OpenOrderError::UnderFlow)?;

            taker_open_order.quote_free = taker_open_order
                .quote_free
                .checked_add(quote_amount)
                .ok_or(OpenOrderError::OverFlow)?;

            // Maker had a bid → locked quote, now receives base
            maker_open_order.quote_locked = maker_open_order
                .quote_locked
                .checked_sub(quote_amount)
                .ok_or(OpenOrderError::UnderFlow)?;

            maker_open_order.base_free = maker_open_order
                .base_free
                .checked_add(base_amount)
                .ok_or(OpenOrderError::OverFlow)?;
        }

        Side::Bid => {
            // Taker bought base → pays quote, receives base
            taker_open_order.quote_locked = taker_open_order
                .quote_locked
                .checked_sub(quote_amount)
                .ok_or(OpenOrderError::UnderFlow)?;

            taker_open_order.base_free = taker_open_order
                .base_free
                .checked_add(base_amount)
                .ok_or(OpenOrderError::OverFlow)?;

            // Maker had an ask → locked base, now receives quote
            maker_open_order.base_locked = maker_open_order
                .base_locked
                .checked_sub(base_amount)
                .ok_or(OpenOrderError::UnderFlow)?;

            maker_open_order.quote_free = maker_open_order
                .quote_free
                .checked_add(quote_amount)
                .ok_or(OpenOrderError::OverFlow)?;
        }
    }

    Ok(())
}
