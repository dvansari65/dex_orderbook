use crate::states::order_schema::enums::Side;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint as AnchorMint, Token, TokenAccount as AnchorTokenAccount},
};
declare_id!("2BRNRPFwJWjgRGV3xeeudGsi9mPBQHxLWFB6r3xpgxku");

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

    use crate::{error::ErrorCode, helpers::match_orders, states::order_schema::enums::Side};

    use super::*;
    use anchor_spl::token::Transfer;
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
        bids.leaf_count = 32;
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

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        max_base_size: u64,
        client_order_id: u64,
        price_in_quote_lots: u64,
        order_type: OrderType,
        side: Side,
    ) -> Result<()> {
        println!("place order triggered:");
        let market = &mut ctx.accounts.market;
        let open_order = &mut ctx.accounts.open_order;
        let owner = &mut ctx.accounts.owner;
        let event_queue = &mut ctx.accounts.event_queue;
        let order_id = market.next_order_id;
        let asks = &mut ctx.accounts.asks;
        let bids = &mut ctx.accounts.bids;
        msg!(
            "order size which is obtain from user:{}",
            market.min_order_size
        );
        market.next_order_id = market
            .next_order_id
            .checked_add(1)
            .ok_or(MarketError::OrderIdOverFlow)?;
        require!(market.market_status == 1, MarketError::MarketActiveError);

        require!(
            max_base_size >= market.min_order_size,
            MarketError::MarketOrderSizeError
        );

        let base_lots = max_base_size / market.base_lot_size;

        let mut created_order = Order {
            order_type,
            side,
            quantity: base_lots,
            owner: owner.key(),
            order_id,
            client_order_id,
            price: price_in_quote_lots,
            order_status: OrderStatus::PartialFill,
        };
        match order_type {
            OrderType::Limit => {
                match_orders(side, &mut created_order, asks, bids, event_queue)?;
            }
            OrderType::PostOnly => {}
            OrderType::ImmediateOrCancel => {}
        }
        let slab = match side {
            Side::Ask => &mut ctx.accounts.asks,
            Side::Bid => &mut ctx.accounts.bids,
        };

        match side {
            Side::Bid => {
                let amount_to_lock = price_in_quote_lots
                    .checked_mul(base_lots)
                    .ok_or(MarketError::MathOverflow)?
                    .checked_mul(market.quote_lot_size)
                    .ok_or(MarketError::MathOverflow)?;

                require!(
                    ctx.accounts.user_quote_vault.owner == owner.key(),
                    MarketError::InvalidTokenAccountOwner
                );

                require!(
                    ctx.accounts.user_quote_vault.amount >= amount_to_lock,
                    MarketError::InsufficientQuoteBalance
                );

                require!(
                    ctx.accounts.user_quote_vault.mint == market.quote_mint,
                    MarketError::InvalidTokenMint
                );
                require!(
                    ctx.accounts.quote_vault.amount >= 0, // just to check existence
                    MarketError::DestinationVaultUninitialized
                );
                require!(
                    ctx.accounts.quote_vault.mint == market.quote_mint,
                    MarketError::InvalidTokenMint
                );
                msg!("balance of user:{}",ctx.accounts.user_quote_vault.amount);
                anchor_spl::token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        anchor_spl::token::Transfer {
                            from: ctx.accounts.user_quote_vault.to_account_info(),
                            to: ctx.accounts.quote_vault.to_account_info(),
                            authority: ctx.accounts.owner.to_account_info(),
                        },
                    ),
                    amount_to_lock,
                )?;
                msg!("Transfer successful");
                open_order.quote_locked = open_order
                    .quote_locked
                    .checked_add(amount_to_lock)
                    .ok_or(MarketError::MathOverflow)?;
            }
            Side::Ask => {
                let amount_to_lock = base_lots
                    .checked_mul(market.base_lot_size)
                    .ok_or(MarketError::MathOverflow)?;
                require!(
                    ctx.accounts.user_base_vault.amount >= amount_to_lock,
                    MarketError::InsufficientBaseBalance
                );
                require!(
                    ctx.accounts.user_base_vault.owner == owner.key(),
                    MarketError::InvalidTokenAccountOwner
                );
                require!(
                    ctx.accounts.user_base_vault.mint == market.base_mint,
                    MarketError::InvalidTokenMint
                );
              
                anchor_spl::token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        anchor_spl::token::Transfer {
                            from: ctx.accounts.user_base_vault.to_account_info(),
                            to: ctx.accounts.base_vault.to_account_info(),
                            authority: ctx.accounts.owner.to_account_info(),
                        },
                    ),
                    amount_to_lock,
                )?;
                open_order.base_locked = open_order
                    .base_locked
                    .checked_add(amount_to_lock)
                    .ok_or(MarketError::MathOverflow)?;
            }
        }
        Slab::insert_order(
            slab,
            order_id,
            base_lots,
            ctx.accounts.owner.key(),
            price_in_quote_lots,
            created_order.order_status,
            client_order_id,
            &market.key(),
            side
        )?;
        let pushed_order = OpenOrders::push_order(open_order, created_order)?;
        msg!("order pushed : {:?} into the open order:", pushed_order);
        Ok(())
    }
    pub fn cancel_order(ctx: Context<CancelOrder>, order_id: u64) -> Result<()> {
        let open_order = &mut ctx.accounts.open_order;
        let slab = &mut ctx.accounts.slab;
        let market = &mut ctx.accounts.market;
        let event_queue = &mut ctx.accounts.event_queue;
        require!(
            open_order.owner.key() == ctx.accounts.owner.key(),
            ErrorCode::UnAuthorized
        );
        let order_position = open_order
            .orders
            .iter()
            .position(|n| n.order_id == order_id)
            .ok_or(OpenOrderError::OrderNotFound)?;
        let order = open_order.orders.get(order_position).unwrap();
        let order_from_event = event_queue
            .events
            .iter()
            .find(|n| n.order_id == order_id)
            .unwrap();
        // let event = QueueEvent {
        //     order_id,
        //     price: order_from_event.price,
        //     event_type: EventType::Cancel,
        //     quantity: order_from_event.quantity,
        //     maker: order_from_event.maker,
        //     taker: order_from_event.taker,
        //     timestamp: order_from_event.timestamp,
        // };
        // emit!(event);
        // EventQueue::insert_event(event_queue, &event)?;
        match order.side {
            Side::Ask => {
                let locked_base = order.quantity;

                open_order.base_locked = open_order
                    .base_locked
                    .checked_sub(locked_base)
                    .ok_or(ErrorCode::UnderFlow)?;

                open_order.base_free = open_order
                    .base_free
                    .checked_add(locked_base)
                    .ok_or(ErrorCode::OverFlow)?;

                let market_key = market.key();
                let seeds = &[
                    b"vault_signer".as_ref(),
                    market_key.as_ref(),
                    &[market.vault_signer_nonce],
                ];
                let signer_seeds = &[&seeds[..]];

                anchor_spl::token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.base_vault.to_account_info(),
                            to: ctx.accounts.user_base_vault.to_account_info(),
                            authority: ctx.accounts.vault_signer.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    locked_base,
                )?;
            }
            Side::Bid => {
                let quote_amount = order
                    .price
                    .checked_mul(order.quantity)
                    .ok_or(ErrorCode::OverFlow)?;

                open_order.quote_locked = open_order
                    .quote_locked
                    .checked_sub(quote_amount)
                    .ok_or(ErrorCode::UnderFlow)?;

                open_order.quote_free = open_order
                    .quote_free
                    .checked_add(quote_amount)
                    .ok_or(ErrorCode::OverFlow)?;

                let market_key = market.key();
                let seeds = &[
                    b"vault_signer".as_ref(),
                    market_key.as_ref(),
                    &[market.vault_signer_nonce],
                ];
                let signer_seeds = &[&seeds[..]];

                anchor_spl::token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.quote_vault.to_account_info(),
                            to: ctx.accounts.user_quote_vault.to_account_info(),
                            authority: ctx.accounts.vault_signer.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    quote_amount,
                )?;
            }
        }
        let removed_node = slab.remove_order(&order_id)?;
        msg!(" order removed from the slab :{:?}", removed_node);
        let returned_open_order = open_order.remove_order(order_id)?;

        msg!(
            "open order after deleting the order:{:?}",
            returned_open_order
        );

        Ok(())
    }
    // pub fn consume_events(ctx: Context<ConsumeEvents>, limit: u16) -> Result<()> {
    //     let event_queue = &mut ctx.accounts.event_queue;
    //     let open_orders = &mut ctx.accounts.open_orders;
    //     let market = &ctx.accounts.market;

    //     let to_process = std::cmp::min(limit as usize, event_queue.events.len());

    //     for _ in 0..to_process {
    //         if event_queue.events.is_empty() {
    //             break;
    //         }

    //         let event = event_queue.events.remove(0);
    //         event_queue.count = event_queue.count.saturating_sub(1);

    //         // Update if this user was involved
    //         if event.maker == open_orders.owner {
    //             // User was SELLER (maker)
    //             let base_amount = event
    //                 .quantity
    //                 .checked_mul(market.base_lot_size)
    //                 .ok_or(MarketError::MathOverflow)?;
    //             let quote_amount = event
    //                 .quantity
    //                 .checked_mul(event.price)
    //                 .ok_or(MarketError::MathOverflow)?
    //                 .checked_mul(market.quote_lot_size)
    //                 .ok_or(MarketError::MathOverflow)?;

    //             open_orders.base_locked = open_orders
    //                 .base_locked
    //                 .checked_sub(base_amount)
    //                 .ok_or(ErrorCode::UnderFlow)?;
    //             open_orders.quote_free = open_orders
    //                 .quote_free
    //                 .checked_add(quote_amount)
    //                 .ok_or(ErrorCode::OverFlow)?;
    //         }

    //         if event.taker == open_orders.owner {
    //             // User was BUYER (taker)
    //             let base_amount = event
    //                 .quantity
    //                 .checked_mul(market.base_lot_size)
    //                 .ok_or(MarketError::MathOverflow)?;
    //             let quote_amount = event
    //                 .quantity
    //                 .checked_mul(event.price)
    //                 .ok_or(MarketError::MathOverflow)?
    //                 .checked_mul(market.quote_lot_size)
    //                 .ok_or(MarketError::MathOverflow)?;

    //             open_orders.quote_locked = open_orders
    //                 .quote_locked
    //                 .checked_sub(quote_amount)
    //                 .ok_or(ErrorCode::UnderFlow)?;
    //             open_orders.base_free = open_orders
    //                 .base_free
    //                 .checked_add(base_amount)
    //                 .ok_or(ErrorCode::OverFlow)?;
    //         }
    //     }

    //     msg!("Consumed {} events", to_process);
    //     Ok(())
    // }
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
}

// TODO:implement consume event instn  and settle fund instn
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

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, seeds = [b"asks",market.key().as_ref()],bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids",market.key().as_ref()],bump)]
    pub bids: Account<'info, Slab>,

    #[account(
        mut,
        seeds = [b"open_order",market.key().as_ref(),owner.key().as_ref()],
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

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"open_order",market.key().as_ref(),owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

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

    #[account(mut)]
    pub slab: Account<'info, Slab>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

    #[account(mut, seeds = [b"asks",market.key().as_ref()],bump)]
    pub asks: Account<'info, Slab>,

    #[account(mut, seeds = [b"bids",market.key().as_ref()],bump)]
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

#[derive(Accounts)]
pub struct ConsumeEvents<'info> {
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub event_queue: Account<'info, EventQueue>,

    #[account(
        mut,
        seeds = [b"open_order", market.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_orders: Account<'info, OpenOrders>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeOpenOrder<'info> {
    #[account(
        init,
        space = 8 + OpenOrders::INIT_SPACE,
        seeds=[b"open_order",market.key().as_ref(),owner.key().as_ref()],
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
