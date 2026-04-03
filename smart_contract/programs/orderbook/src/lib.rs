use crate::states::order_schema::enums::Side;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint as AnchorMint, Token, TokenAccount as AnchorTokenAccount};
declare_id!("2BRNRPFwJWjgRGV3xeeudGsi9mPBQHxLWFB6r3xpgxku");

pub mod assets;
pub mod calculate;
pub mod error;
pub mod events;
pub mod helpers;
pub mod state;
pub mod states;
use error::*;

use state::*;

#[program]
pub mod orderbook {
    use std::u32;

    use crate::{
        assets::{lock_ask_funds, lock_bid_funds, unlock_ask_funds, unlock_bid_funds},
        events::{dispatch_event, dispatch_fill_event, EventParams},
        helpers::{
            get_next_order_id, try_match, try_match_ioc, update_trader_entry, would_match_post_only,
        },
        states::order_schema::enums::Side,
    };

    use super::*;
    pub fn initialise_market(
        ctx: Context<InitializeMarket>,
        base_lot_size: u64,
        quote_lot_size: u64,
        maker_fees_bps: u64,
        taker_fees_bps: u64,
    ) -> Result<()> {
        msg!("Initialise market hit...!");

        let market = &mut ctx.accounts.market;
        let asks = &mut ctx.accounts.asks;
        let bids = &mut ctx.accounts.bids;

        asks.free_list_len = 32;
        bids.free_list_len = 32;
        asks.leaf_count = 0;
        bids.leaf_count = 0;
        asks.head_index = u32::MAX;
        bids.head_index = u32::MAX;

        market.next_order_id = 0;

        // Admin and tokens
        market.admin = ctx.accounts.admin.key();
        market.base_mint = ctx.accounts.base_mint.key();
        market.quote_mint = ctx.accounts.quote_mint.key();

        // On-chain orderbook accounts
        market.bids = bids.key();
        market.asks = asks.key();

        // Vaults
        market.base_vault = ctx.accounts.base_vault.key();
        market.quote_vault = ctx.accounts.quote_vault.key();

        // Lot sizes
        market.base_lot_size = base_lot_size;
        market.quote_lot_size = quote_lot_size;

        // Fees
        market.maker_fees_bps = maker_fees_bps;
        market.taker_fees_bps = taker_fees_bps;

        // Vault signer nonce
        market.vault_signer_nonce = ctx.bumps.vault_signer;

        // Market defaults
        market.market_status = 1; // Active
        market.max_orders_per_user = 100;
        market.min_order_size = base_lot_size;

        Ok(())
    }

    pub fn place_limit_order(
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
        msg!("taker qty at the begining:{}", max_base_size);
        msg!("price at the beginning:{}",price);
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

        // ── 1. Lock funds ──
        match side {
            // sirf user jis price me order place krna chahta hai vahi amount transfer ho rahi h
            // like user ko 5 base token kharidne hai 100 usdc each token, 500 usdc will be transferred to the market vault
            Side::Bid => lock_bid_funds(
                market,
                &owner,
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

        // ── 2. Emit Place event ──
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

        // try_match returns Vec<FillRecord>
        // Each FillRecord has: maker_order_id, maker_owner, fill_qty,
        //                      execution_price, maker_fully_filled, maker_remaining_qty
        let fills = try_match(side, base_lots, quote_lots, opposite_slab)?;
        msg!("fill record:{:?}", fills);

        if fills.is_empty() {
            same_slab.insert_order(
                order_id,
                &order_type,
                base_lots, // full quantity, nothing filled
                owner.key(),
                quote_lots,
                OrderStatus::Open,
                client_order_id,
                &market_key,
                side,
            )?;
        } else {
            // ── 5. Per fill: settle + emit ──
            for (_i, fill) in fills.iter().enumerate() {
                let maker_entry = market.get_trader_entry(&fill.maker_owner);
                // updating maker's trading entry
                update_trader_entry(true, side, fill, maker_entry, base_lot_size, quote_lot_size)?;

                let taker_entry = market.get_trader_entry(&owner.key());
                // updating taker's trading entry
                update_trader_entry(
                    false,
                    side,
                    fill,
                    taker_entry,
                    base_lot_size,
                    quote_lot_size,
                )?;
                // dispatch_fill_event pulls maker_order_id and maker_remaining_qty
                // directly from fill — that is how maker_order_id gets into the event
                dispatch_fill_event(
                    market,
                    fill,     // fill.maker_order_id goes into EventParams.maker_order_id
                    order_id, // taker order id
                    owner.key(),
                    client_order_id,
                    side,
                    market_key,
                )?;

                let remaining_qty = base_lots - fill.fill_qty;
                msg!("taker remaining qty:{}",remaining_qty.to_string());
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
                    msg!(
                        "place_limit_order: id={} side={:?} fills={} remaining={}",
                        order_id,
                        side,
                        fills.len(),
                        remaining_qty
                    );
                }
            }
        }
        Ok(())
    }
    pub fn place_ioc_order(
        ctx: Context<PlaceIOCOrder>,
        base_qty: u64,
        price_in_raw_units: u64,
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
        require!(price_in_raw_units > 0, MarketError::InvalidPrice);

        let market_key = market.key();
        let order_id = get_next_order_id(market)?;
        let base_lot_size = market.base_lot_size;
        let quote_lot_size = market.quote_lot_size;

        let base_lots = base_qty / base_lot_size;
        let quote_lots = price_in_raw_units
            .checked_div(quote_lot_size)
            .ok_or(MarketError::MathOverflow)?;

        // ── Resolve taker index BEFORE any other mutable borrow of market ──
        // get_trader_index returns Option<usize> — just the index, no reference held
        let taker_index = market
            .get_trader_index(&owner.key())
            .ok_or(TraderEntryError::EntryNotFound)?;

        // ── 1. Lock funds ──
        match side {
            Side::Bid => lock_bid_funds(
                market,
                owner,
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

        let fill_opt = try_match_ioc(side, quote_lots, base_lots, opposite_slab)?;
        let mut remaining_qty = 0;
        let mut execution_price = 0;
        match fill_opt {
            Some(fill) => {
                let maker_entry = market.get_trader_entry(&fill.maker_owner);
                update_trader_entry(
                    true,
                    side,
                    &fill,
                    maker_entry,
                    base_lot_size,
                    quote_lot_size,
                )?;

                // ── Access taker by index — no outstanding borrow on market ──
                let taker_entry = market.trader_entry.get_mut(taker_index);
                update_trader_entry(
                    false,
                    side,
                    &fill,
                    taker_entry,
                    base_lot_size,
                    quote_lot_size,
                )?;

                remaining_qty = base_lots - fill.fill_qty;
                execution_price = fill.execution_price;

                let event_params = EventParams {
                    event_type: if fill.maker_fully_filled {
                        EventType::Fill
                    } else {
                        EventType::PartialFill
                    },
                    order_id,
                    owner: owner.key(),
                    counterparty: fill.maker_owner,
                    side,
                    price: fill.execution_price,
                    base_quantity: fill.fill_qty,
                    client_order_id,
                    market_pubkey: market_key,
                    maker_order_id: fill.maker_order_id,
                    maker_remaining_qty: fill.maker_remaining_qty,
                    taker_remaining_qty: remaining_qty,
                };
                dispatch_event(market, event_params)?;
            }
            None => {
                // cancel event emitted below
            }
        }

        msg!("remaining qty of taker:{}", remaining_qty);

        // ── Partial fill — release unfilled locked funds back to free ──
        if remaining_qty > 0 {
            // Safe: taker_index was validated at the top, access by index avoids reborrow
            let entry = &mut market.trader_entry[taker_index];
            let amount_move = remaining_qty
                .checked_mul(base_lot_size)
                .ok_or(MarketError::MathOverflow)?;

            let quote_lots_to_move = execution_price
                .checked_mul(quote_lot_size)
                .ok_or(MarketError::MathOverflow)?;

            match side {
                Side::Ask => {
                    entry.trader_state.base_lots_free = entry
                        .trader_state
                        .base_lots_free
                        .checked_add(amount_move)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.base_lots_locked = entry
                        .trader_state
                        .base_lots_locked
                        .checked_sub(amount_move)
                        .ok_or(MarketError::UnderFlow)?;
                }
                Side::Bid => {
                    // suppose i have to buy 5 tokens for 100 usdc each so 500 usdc locked
                    // suppose after matching 3 tokens get filled
                    // quote locked 500-300 = 200 and base free 3, quote free = 200
                    entry.trader_state.quote_lots_free = entry
                        .trader_state
                        .base_lots_free
                        .checked_add(quote_lots_to_move)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.quote_lots_locked = entry
                        .trader_state
                        .quote_lots_locked
                        .checked_sub(quote_lots_to_move)
                        .ok_or(MarketError::UnderFlow)?;
                }
            }

            let event_params = EventParams {
                event_type: EventType::Cancel,
                order_id,
                owner: owner.key(),
                counterparty: Pubkey::default(),
                side,
                price: quote_lots,
                base_quantity: base_lots,
                client_order_id,
                market_pubkey: market_key,
                maker_order_id: 0,
                maker_remaining_qty: 0,
                taker_remaining_qty: remaining_qty,
            };
            dispatch_event(market, event_params)?;
            msg!("place_ioc_order: id={}", order_id);
        }
        Ok(())
    }

    pub fn place_post_only_order(
        ctx: Context<PlacePostOnlyOrder>,
        base_qty: u64,
        price_in_raw_units: u64,
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
        require!(
            base_qty >= market.base_lot_size,
            MarketError::MarketOrderSizeError
        );
        require!(price_in_raw_units > 0, MarketError::InvalidPrice);

        let market_key = market.key();
        let order_id = get_next_order_id(market)?;
        let base_lots = base_qty / market.base_lot_size;
        let quote_lots = price_in_raw_units
            .checked_div(market.quote_lot_size)
            .ok_or(MarketError::MathOverflow)?;

        // ── 1. Reject if would cross ──
        if would_match_post_only(side, quote_lots, &ctx.accounts.asks, &ctx.accounts.bids) {
            msg!("PostOnly rejected: order would match immediately");
            return Err(OrderError::WouldMatchImmediately.into());
        }

        // ── 2. Lock funds ──
        match side {
            Side::Bid => {
                require!(
                    ctx.accounts.user_quote_vault.mint == market.quote_mint,
                    MarketError::InvalidTokenMint
                );
                lock_bid_funds(
                    market,
                    &ctx.accounts.owner,
                    &ctx.accounts.user_quote_vault,
                    &ctx.accounts.quote_vault,
                    &ctx.accounts.token_program,
                    quote_lots,
                    base_lots,
                )?;
            }
            Side::Ask => {
                require!(
                    ctx.accounts.user_base_vault.mint == market.base_mint,
                    MarketError::InvalidTokenMint
                );
                lock_ask_funds(
                    market,
                    &ctx.accounts.owner,
                    &ctx.accounts.user_base_vault,
                    &ctx.accounts.base_vault,
                    &ctx.accounts.token_program,
                    base_lots,
                )?;
            }
        }

        // ── 3. Insert into slab ──
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
            &market_key,
            side,
        )?;

        // ── 4. Emit Place event ──
        dispatch_event(
            market,
            EventParams::non_fill(
                EventType::Place,
                order_id,
                ctx.accounts.owner.key(),
                side,
                quote_lots,
                base_lots,
                client_order_id,
                market_key,
            ),
        )?;
        msg!(
            "place_post_only_order: id={} side={:?} price={}",
            order_id,
            side,
            quote_lots
        );
        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, order_id: u64, side: Side) -> Result<()> {
        let owner = &ctx.accounts.owner;

        let market = &mut ctx.accounts.market;
        let market_key = market.key();

        // Remove from slab
        let slab = match side {
            Side::Ask => &mut ctx.accounts.asks,
            Side::Bid => &mut ctx.accounts.bids,
        };
        let deleted_order = slab.remove_order(&order_id)?;

        // Move locked → free — no token transfer here
        // Token transfer happens in consume_events when Cancel event is processed
        match side {
            Side::Ask => {
                unlock_ask_funds(market, deleted_order.quantity, &owner.key())?;
            }
            Side::Bid => {
                unlock_bid_funds(
                    market,
                    deleted_order.price,
                    &owner.key(),
                    deleted_order.quantity,
                )?;
            }
        }
        // Dispatch Cancel event
        // taker_remaining_qty = order.quantity — full remaining qty jo cancel ho rahi hai
        // consume_events mein yahi use hoga token return calculate karne ke liye
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
        msg!("order cancelled: {:?}", deleted_order);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    // Market account
    #[account(init, payer = admin, space = 8 + Market::INIT_SPACE)]
    pub market: Account<'info, Market>,

    // Orderbook slabs
    #[account(init, seeds = [b"bids",market.key().as_ref()], payer = admin, space = 8 + Slab::INIT_SPACE,bump)]
    pub bids: Account<'info, Slab>,

    #[account(init, seeds = [b"asks",market.key().as_ref()] , payer = admin, space = 8 + Slab::INIT_SPACE,bump)]
    pub asks: Account<'info, Slab>,

    // Vault token accounts (program-controlled)
    #[account(
        init,
        payer = admin,
        token::mint = base_mint,
        token::authority = vault_signer
    )]
    pub base_vault: Account<'info, AnchorTokenAccount>,

    #[account(
        init,
        payer = admin,
        token::mint = quote_mint,
        token::authority = vault_signer
    )]
    pub quote_vault: Account<'info, AnchorTokenAccount>,

    // PDA that can manage vaults
    /// CHECK:
    /// This is a PDA used only as the authority for the token vaults.
    /// It holds no data, is never read or written, and is only used for signing.
    /// Safe because Anchor verifies the PDA seeds & bump.
    #[account(
        seeds = [b"vault_signer", market.key().as_ref()],
        bump
    )]
    pub vault_signer: UncheckedAccount<'info>,

    // Admin signing the transaction
    #[account(mut)]
    pub admin: Signer<'info>,

    // Token mints
    pub base_mint: Account<'info, AnchorMint>,
    pub quote_mint: Account<'info, AnchorMint>,

    // Programs
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

// ── PlaceLimitOrder ───────────────────────────────────────────────────────────
// No vault_signer — matching only does accounting, tokens only flow IN.
// remaining_accounts: one maker OpenOrders PDA per expected fill (in fill order).
#[derive(Accounts)]
pub struct PlaceLimitOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, seeds = [b"asks", market.key().as_ref()], bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids", market.key().as_ref()], bump)]
    pub bids: Account<'info, Slab>,

    #[account(mut)]
    pub quote_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, AnchorTokenAccount>,

    #[account(mut)]
    pub user_base_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub user_quote_vault: Account<'info, AnchorTokenAccount>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ── PlaceIOCOrder ─────────────────────────────────────────────────────────────
// remaining_accounts: one maker OpenOrders PDA if you expect a fill.
#[derive(Accounts)]
pub struct PlaceIOCOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, seeds = [b"asks", market.key().as_ref()], bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids", market.key().as_ref()], bump)]
    pub bids: Account<'info, Slab>,

    #[account(mut)]
    pub quote_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, AnchorTokenAccount>,

    #[account(mut)]
    pub user_base_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub user_quote_vault: Account<'info, AnchorTokenAccount>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ── PlacePostOnlyOrder ────────────────────────────────────────────────────────
#[derive(Accounts)]
pub struct PlacePostOnlyOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, seeds = [b"asks", market.key().as_ref()], bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids", market.key().as_ref()], bump)]
    pub bids: Account<'info, Slab>,

    #[account(mut)]
    pub quote_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, AnchorTokenAccount>,

    #[account(mut)]
    pub user_base_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub user_quote_vault: Account<'info, AnchorTokenAccount>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ── CancelOrder ───────────────────────────────────────────────────────────────
// Removed vs original: vault_signer, quote_vault, base_vault, user_* vaults
// Cancel is pure accounting — no token transfers.
#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, seeds = [b"asks", market.key().as_ref()], bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids", market.key().as_ref()], bump)]
    pub bids: Account<'info, Slab>,

    pub owner: Signer<'info>,
}
