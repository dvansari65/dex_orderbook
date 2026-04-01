use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

use crate::{
    error::{MarketError},
    state::{ Market, TraderEntry, TraderState},
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
    market: &mut Market,
    owner: &Signer<'info>,
    user_quote_vault: &Account<'info, TokenAccount>,
    quote_vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
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

    let trader_state = TraderState {
        base_lots_free: 0,
        base_lots_locked: 0,
        quote_lots_locked: amount_to_lock,
        quote_lots_free: 0,
    };
    let trader_entry = TraderEntry {
        trader_key: owner.key(),
        trader_state,
    };
    market.trader_entry.push(trader_entry);
    msg!("Transfer successful");
    Ok(amount_to_lock)
}

pub fn lock_ask_funds<'info>(
    market: &mut Market,
    owner: &Signer<'info>,
    user_base_vault: &Account<'info, TokenAccount>,
    base_vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
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
    let trader_state = TraderState {
        base_lots_free: 0,
        base_lots_locked: amount_to_lock,
        quote_lots_locked: 0,
        quote_lots_free: 0,
    };
    let trader_entry = TraderEntry {
        trader_key: owner.key(),
        trader_state,
    };
    market.trader_entry.push(trader_entry);
    Ok(amount_to_lock)
}

pub fn unlock_bid_funds<'info>(
    market: &mut Market,
    quote_lots: u64,
    owner: &Pubkey,
    taker_qty: u64,
) -> Result<u64> {
    let amount_to_move = quote_lots
        .checked_mul(taker_qty)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    require!(amount_to_move > 0, MarketError::InvalidPrice);

    let existing_entry = market.get_trader_entry(owner);
    match existing_entry {
        Some(entry) => {
            entry.trader_state.quote_lots_locked = entry
                .trader_state
                .quote_lots_locked
                .checked_sub(amount_to_move)
                .ok_or(MarketError::UnderFlow)?;

            entry.trader_state.base_lots_free = entry
                .trader_state
                .base_lots_free
                .checked_add(amount_to_move)
                .ok_or(MarketError::MathOverflow)?;
        }
        None => {
            let trader_state = TraderState {
                base_lots_free: 0,
                base_lots_locked: amount_to_move,
                quote_lots_locked: 0,
                quote_lots_free: 0,
            };
            let trader_entry = TraderEntry {
                trader_key: owner.key(),
                trader_state,
            };
            market.trader_entry.push(trader_entry);
        }
    }
    Ok(amount_to_move)
}

pub fn unlock_ask_funds<'info>(
    market: &mut Market, 
    taker_qty: u64, 
    owner: &Pubkey
) -> Result<u64> {
    let amount_to_move = taker_qty
        .checked_mul(market.base_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    require!(amount_to_move > 0, MarketError::InvalidBaseQty);
    let existing_entry = market.get_trader_entry(owner);
    match existing_entry {
        Some(entry) => {
            entry.trader_state.base_lots_locked = entry
                .trader_state
                .base_lots_locked
                .checked_sub(amount_to_move)
                .ok_or(MarketError::UnderFlow)?;

            entry.trader_state.base_lots_free = entry
                .trader_state
                .base_lots_free
                .checked_add(amount_to_move)
                .ok_or(MarketError::MathOverflow)?;
        }
        None => {
            let trader_state = TraderState {
                base_lots_free: amount_to_move,
                base_lots_locked: 0,
                quote_lots_locked: 0,
                quote_lots_free: 0,
            };
            let trader_entry = TraderEntry {
                trader_key: owner.key(),
                trader_state,
            };
            market.trader_entry.push(trader_entry);
        }
    }

    Ok(amount_to_move)
}
