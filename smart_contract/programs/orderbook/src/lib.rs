use crate::{assets::transfer_from_vault, states::order_schema::enums::Side};
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
    use std::{collections::HashMap, u32};

    use anchor_spl::{
        associated_token::get_associated_token_address,
        token::{self, Transfer},
    };

    use crate::{
        assets::{credit_fill, lock_ask_funds, lock_bid_funds, unlock_ask_funds, unlock_bid_funds},
        error::ErrorCode,
        events::{EventParams, dispatch_event, dispatch_fill_event},
        helpers::{get_next_order_id, settle_cancel, settle_fill, try_match, try_match_ioc, would_match_post_only},
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
        market.event_queue = ctx.accounts.event_queue.key();

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
        msg!("taker qty at the begining:{}", max_base_size);
        require!(market.market_status == 1, MarketError::MarketActiveError);
        require!(
            max_base_size >= market.base_lot_size,
            MarketError::MarketOrderSizeError
        );

        let market_key = market.key();
        let order_id = get_next_order_id(market)?;
        let base_lots = max_base_size / market.base_lot_size;
        let quote_lots = price
            .checked_div(market.quote_lot_size)
            .ok_or(MarketError::MathOverflow)?;

        // ── 1. Lock funds ──
        match side {
            // sirf user jis price me order place krna chahta hai vahi amount transfer ho rahi h
            // like user ko 5 base token kharidne hai 100 usdc each token, 500 usdc will be transferred to the market vault
            Side::Bid => lock_bid_funds(
                market,
                &ctx.accounts.owner,
                &ctx.accounts.user_quote_vault,
                &ctx.accounts.quote_vault,
                &ctx.accounts.token_program,
                &mut ctx.accounts.open_order,
                quote_lots,
                base_lots,
            )?,
            Side::Ask => lock_ask_funds(
                market,
                &ctx.accounts.owner,
                &ctx.accounts.user_base_vault,
                &ctx.accounts.base_vault,
                &ctx.accounts.token_program,
                &mut ctx.accounts.open_order,
                base_lots,
            )?,
        };

        // ── 2. Emit Place event ──
        dispatch_event(
            market,
            &mut ctx.accounts.event_queue,
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

        // ── 3. Build taker order ──
        let mut taker_order = Order {
            order_type,
            side,
            quantity: base_lots,
            owner: ctx.accounts.owner.key(),
            order_id,
            client_order_id,
            price: quote_lots,
            order_status: OrderStatus::Open,
        };

        // ── 4. Run pure match engine ──
        let opposite_slab = match side {
            Side::Ask => &mut ctx.accounts.bids,
            Side::Bid => &mut ctx.accounts.asks,
        };

        // try_match returns Vec<FillRecord>
        // Each FillRecord has: maker_order_id, maker_owner, fill_qty,
        //                      execution_price, maker_fully_filled, maker_remaining_qty
        let fills = try_match(side, &mut taker_order, opposite_slab)?;

        // ── 5. Per fill: settle + emit ──
        for (i, fill) in fills.iter().enumerate() {
            // dispatch_fill_event pulls maker_order_id and maker_remaining_qty
            // directly from fill — that is how maker_order_id gets into the event
            dispatch_fill_event(
                market,
                &mut ctx.accounts.event_queue,
                fill,     // fill.maker_order_id goes into EventParams.maker_order_id
                order_id, // taker order id
                ctx.accounts.owner.key(),
                client_order_id,
                side,
                market_key,
            )?;
        }

        // ── 6. Determine final status ──
        taker_order.order_status = match (taker_order.quantity == 0, !fills.is_empty()) {
            (true, _) => OrderStatus::Fill,
            (false, true) => OrderStatus::PartialFill,
            (false, false) => OrderStatus::Open,
        };
        msg!("taker qty filled:{}", taker_order.quantity);
        // ── 7. Insert resting quantity into slab if not fully filled ──
        if taker_order.quantity > 0 {
            msg!("inserting into open order....:{}", taker_order.quantity);
            let same_slab = match side {
                Side::Ask => &mut ctx.accounts.asks,
                Side::Bid => &mut ctx.accounts.bids,
            };
            same_slab.insert_order(
                order_id,
                &order_type,
                taker_order.quantity,
                ctx.accounts.owner.key(),
                quote_lots,
                taker_order.order_status,
                client_order_id,
                &market_key,
                side,
            )?;
            OpenOrders::push_order(&mut ctx.accounts.open_order, taker_order)?;
        }

        msg!(
            "place_limit_order: id={} side={:?} fills={} remaining={}",
            order_id,
            side,
            fills.len(),
            taker_order.quantity
        );

        Ok(())
    }
    pub fn place_ioc_order(
        ctx: Context< PlaceIOCOrder>,
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
        let event_queue = &mut ctx.accounts.event_queue;
        let market_key = market.key();
        let order_id = get_next_order_id(market)?;
        let base_lots = base_qty / market.base_lot_size;
        let quote_lots = price_in_raw_units
            .checked_div(market.quote_lot_size)
            .ok_or(MarketError::MathOverflow)?;

        // ── 1. Lock funds ──
        match side {
            Side::Bid => lock_bid_funds(
                market,
                owner,
                &ctx.accounts.user_quote_vault,
                &ctx.accounts.quote_vault,
                &ctx.accounts.token_program,
                &mut ctx.accounts.open_order,
                quote_lots,
                base_lots,
            )?,
            Side::Ask => lock_ask_funds(
                market,
                owner,
                &ctx.accounts.user_base_vault,
                &ctx.accounts.base_vault,
                &ctx.accounts.token_program,
                &mut ctx.accounts.open_order,
                base_lots,
            )?,
        };

        // ── 2. Build order + match ──
        let mut order = Order {
            order_type,
            side,
            quantity: base_lots,
            owner: owner.key(),
            order_id,
            client_order_id,
            price: quote_lots,
            order_status: OrderStatus::Open,
        };

        let opposite_slab = match side {
            Side::Ask => &mut ctx.accounts.bids,
            Side::Bid => &mut ctx.accounts.asks,
        };
        dispatch_event(
            market,
            event_queue,
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

        let fill_opt = try_match_ioc(side, &mut order, opposite_slab)?;

        match fill_opt {
            Some(fill) => {
                let event_params = EventParams {
                    event_type:if fill.maker_fully_filled {
                        EventType::Fill
                    }else {
                        EventType::PartialFill
                    },
                    order_id: order.order_id,
                    owner: owner.key(),
                    counterparty: fill.maker_owner,
                    side,
                    price: fill.execution_price,
                    base_quantity: fill.fill_qty,
                    client_order_id,
                    market_pubkey: market_key,
                    maker_order_id: fill.maker_order_id,
                    maker_remaining_qty: fill.maker_remaining_qty,
                    taker_remaining_qty: order.quantity,
                };
                // ── 3c. Emit fill event ──
                dispatch_event(market, event_queue, event_params)?;

                order.order_status = if order.quantity == 0 {
                    OrderStatus::Fill
                } else {
                    OrderStatus::PartialFill
                };
            }
            None => {
                order.order_status = OrderStatus::Cancel;
            }
        }

       if order.quantity > 0 {
         // ── No fill — unlock everything back to free ──
         let event_params = EventParams {
            event_type: EventType::Cancel,
            order_id: order.order_id,
            owner: owner.key(),
            counterparty: Pubkey::default(),
            side,
            price: quote_lots,
            base_quantity: base_lots,
            client_order_id,
            market_pubkey: market_key,
            maker_order_id: 0,
            maker_remaining_qty: 0,
            taker_remaining_qty: order.quantity,
        };
        // push krdo cancel event bhi kyu ki jab hum fill event ke fund settle karenge vo to hum bas jo fill hue
        // uske fund settle karenge, cancle event ke fund hum settle kr sakte hai kyu ki vo unfilled portion ke liye
        // emit krenge hum ya to kisine cancel kiya h order, cancel event ke fund settlement ka aur fill event fund
        // settlement ka koi relation nahi hai

        // ab jab event dispatch karenge event type pass krnege boolean ke jagah
        dispatch_event(market, event_queue, event_params)?;
       }
        msg!(
            "place_ioc_order: id={} status={:?}",
            order_id,
            order.order_status
        );
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
                    &mut ctx.accounts.open_order,
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
                    &mut ctx.accounts.open_order,
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
            &mut ctx.accounts.event_queue,
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

        // ── 5. Push to open orders list ──
        let order = Order {
            order_type,
            side,
            quantity: base_lots,
            owner: ctx.accounts.owner.key(),
            order_id,
            client_order_id,
            price: quote_lots,
            order_status: OrderStatus::Open,
        };
        OpenOrders::push_order(&mut ctx.accounts.open_order, order)?;
        msg!(
            "place_post_only_order: id={} side={:?} price={}",
            order_id,
            side,
            quote_lots
        );
        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, order_id: u64) -> Result<()> {
        let open_order = &mut ctx.accounts.open_order;
        let owner = &ctx.accounts.owner;

        require!(open_order.owner == owner.key(), ErrorCode::UnAuthorized);

        // Find order in open orders list
        let order_pos = open_order
            .orders
            .iter()
            .position(|o| o.order_id == order_id)
            .ok_or(OpenOrderError::OrderNotFound)?;

        let order = open_order.orders[order_pos];

        let market = &mut ctx.accounts.market;
        let market_key = market.key();

        // Remove from slab
        let slab = match order.side {
            Side::Ask => &mut ctx.accounts.asks,
            Side::Bid => &mut ctx.accounts.bids,
        };
        slab.remove_order(&order_id)?;

        // Move locked → free — no token transfer here
        // Token transfer happens in consume_events when Cancel event is processed
        match order.side {
            Side::Ask => {
                let base_amount = order
                    .quantity
                    .checked_mul(market.base_lot_size)
                    .ok_or(MarketError::MathOverflow)?;

                open_order.base_locked = open_order
                    .base_locked
                    .checked_sub(base_amount)
                    .ok_or(OpenOrderError::UnderFlow)?;

                open_order.base_free = open_order
                    .base_free
                    .checked_add(base_amount)
                    .ok_or(OpenOrderError::OverFlow)?;
            }
            Side::Bid => {
                let quote_amount = order
                    .price
                    .checked_mul(order.quantity)
                    .ok_or(MarketError::MathOverflow)?
                    .checked_mul(market.quote_lot_size)
                    .ok_or(MarketError::MathOverflow)?;

                open_order.quote_locked = open_order
                    .quote_locked
                    .checked_sub(quote_amount)
                    .ok_or(OpenOrderError::UnderFlow)?;

                open_order.quote_free = open_order
                    .quote_free
                    .checked_add(quote_amount)
                    .ok_or(OpenOrderError::OverFlow)?;
            }
        }

        // Dispatch Cancel event
        // taker_remaining_qty = order.quantity — full remaining qty jo cancel ho rahi hai
        // consume_events mein yahi use hoga token return calculate karne ke liye
        dispatch_event(
            market,
            &mut ctx.accounts.event_queue,
            EventParams {
                event_type: EventType::Cancel,
                order_id: order.order_id,
                owner: owner.key(),
                counterparty: Pubkey::default(), // cancel mein koi counterparty nahi
                side: order.side,
                price: order.price,            // quote lots
                base_quantity: order.quantity, // base lots
                client_order_id: order.client_order_id,
                market_pubkey: market_key,
                maker_order_id: 0,                   // cancel mein maker nahi hota
                maker_remaining_qty: 0,              // cancel mein maker nahi hota
                taker_remaining_qty: order.quantity, // yahi wapas karana hai
            },
        )?;

        // Remove from open orders list
        open_order.remove_order(order_id)?;

        msg!(
            "cancel_order: id={} side={:?} qty={}",
            order_id,
            order.side,
            order.quantity
        );
        Ok(())
    }
    pub fn initialize_open_order(ctx: Context<InitializeOpenOrder>) -> Result<()> {
        let open_order = &mut ctx.accounts.open_order;
        open_order.market = ctx.accounts.market.key();
        open_order.owner = ctx.accounts.owner.key();
        open_order.base_free = 0;
        open_order.base_locked = 0;
        open_order.orders_count = 0;
        open_order.quote_free = 0;
        open_order.quote_locked = 0;
        open_order.orders = Vec::new();
        Ok(())
    }
    pub fn consume_event(ctx: Context<ConsumeEvent>) -> Result<()> {
        let market_key = ctx.accounts.market.key();
        let market = &ctx.accounts.market;
        
        // Pop single event - atomic per instruction
        let event = ctx
            .accounts
            .event_queue
            .pop_front()
            .ok_or(EventQueueError::QueueEmpty)?;
    
        // Vault signer seeds
        let seeds: &[&[u8]] = &[
            b"vault_signer",
            market_key.as_ref(),
            &[market.vault_signer_nonce],
        ];
        let signer_seeds = &[seeds];
    
        match event.event_type {
            EventType::Fill | EventType::PartialFill => {
                settle_fill(
                    &ctx,
                    &event,
                    market,
                    signer_seeds,
                )?;
            }
            EventType::Cancel => {
                settle_cancel(
                    &ctx,
                    &event,
                    market,
                    signer_seeds,
                )?;
            }
            _ => return Err(ConsumeEventsError::NonSettleableEvent.into()),
        }
    
        msg!("consume_event: processed {:?}", event.event_type);
        Ok(())
    }   
    pub fn update_open_orders(
        ctx: Context<UpdateOpenOrders>,
        price_in_quote_lots:u64,
        quantity_in_base_lots:u64,
        side: Side
    )->Result<()>{
        let taker_open_order = &mut ctx.accounts.taker_open_order;
        let maker_open_order = &mut ctx.accounts.maker_open_order;
        let market = &mut ctx.accounts.market;
         //  update maker open order
         let price = price_in_quote_lots
                        .checked_mul(quantity_in_base_lots)
                        .ok_or(OpenOrderError::OverFlow)?
                        .checked_mul(market.quote_lot_size)
                        .ok_or(OpenOrderError::OverFlow)?;

        let base_amount = quantity_in_base_lots
                        .checked_mul(market.base_lot_size)
                        .ok_or(OpenOrderError::OverFlow)?;
        match side {
            Side::Ask => {
                //  first we have to update taker's open order
                taker_open_order.base_locked =  taker_open_order
                                    .base_locked
                                    .checked_sub(base_amount)
                                    .ok_or(OpenOrderError::UnderFlow)?;

                taker_open_order.base_free = taker_open_order
                                    .base_free
                                    .checked_add(base_amount)
                                    .ok_or(OpenOrderError::OverFlow)?;
    
                maker_open_order.quote_free = maker_open_order
                                    .quote_free
                                    .checked_add(price)
                                    .ok_or(OpenOrderError::OverFlow)?;
                maker_open_order.quote_locked = maker_open_order
                                    .quote_locked
                                    .checked_sub(price)
                                    .ok_or(OpenOrderError::UnderFlow)?;
            }
            Side::Bid => {
                taker_open_order.quote_free = taker_open_order
                                    .quote_free
                                    .checked_add(price)
                                    .ok_or(OpenOrderError::OverFlow)?;
                taker_open_order.quote_locked = taker_open_order
                                    .quote_locked
                                    .checked_sub(price)
                                    .ok_or(OpenOrderError::UnderFlow)?;
                maker_open_order.base_locked =  maker_open_order
                                    .base_locked
                                    .checked_sub(base_amount)
                                    .ok_or(OpenOrderError::UnderFlow)?;

                maker_open_order.base_free = maker_open_order
                                    .base_free
                                    .checked_add(base_amount)
                                    .ok_or(OpenOrderError::OverFlow)?;
            }
        }
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

    // Event queue
    #[account(init, payer = admin, space = 8 + EventQueue::INIT_SPACE)]
    pub event_queue: Account<'info, EventQueue>,

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

    #[account(
        mut,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

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

    #[account(
        mut,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

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

    #[account(
        mut,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

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

    #[account(
        mut,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

    #[account(mut, seeds = [b"asks", market.key().as_ref()], bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids", market.key().as_ref()], bump)]
    pub bids: Account<'info, Slab>,

    pub owner: Signer<'info>,
}
// ── InitializeOpenOrder ───────────────────────────────────────────────────────
// Unchanged from your original.
#[derive(Accounts)]
pub struct InitializeOpenOrder<'info> {
    #[account(
        init,
        space = 8 + OpenOrders::INIT_SPACE,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        payer = owner,
        bump
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ConsumeEvent<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

    #[account(
        mut,
        constraint = base_vault.key() == market.base_vault
    )]
    pub base_vault: Account<'info, AnchorTokenAccount>,

    #[account(
        mut,
        constraint = quote_vault.key() == market.quote_vault
    )]
    pub quote_vault: Account<'info, AnchorTokenAccount>,

    /// CHECK: PDA vault authority
    #[account(
        seeds = [b"vault_signer", market.key().as_ref()],
        bump
    )]
    pub vault_signer: UncheckedAccount<'info>,

    // Taker token accounts - verified against event.owner
    #[account(mut)]
    pub taker_base_account: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub taker_quote_account: Account<'info, AnchorTokenAccount>,

    // Maker token accounts - verified against event.counterparty
    #[account(mut)]
    pub maker_base_account: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub maker_quote_account: Account<'info, AnchorTokenAccount>,

    pub crank: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct  UpdateOpenOrders<'info>{
    #[account(mut)]
    pub taker_open_order : Account<'info,OpenOrders>,
    #[account(mut)]
    pub maker_open_order : Account<'info,OpenOrders>,
    #[account(mut)]
    pub market : Account<'info,Market>
}