use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint as AnchorMint, TokenAccount as AnchorTokenAccount, Token},
};

declare_id!("JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H");

pub mod error;
pub mod events;
pub mod helpers;
pub mod state;
use error::*;
use helpers::*;
use state::*;

#[program]
pub mod orderbook {
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
        // Admin and tokens
        market.admin = ctx.accounts.admin.key();
        market.base_mint = ctx.accounts.base_mint.key();
        market.quote_mint = ctx.accounts.quote_mint.key();

        // On-chain orderbook accounts
        market.bids = ctx.accounts.bids.key();
        market.asks = ctx.accounts.asks.key();
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
        price: u64,
        order_type: OrderType,
        side: Side,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let open_order = &mut ctx.accounts.open_order;
        require!(market.market_status == 1, MarketError::MarketActiveError);

        require!(
            max_base_size >= market.min_order_size,
            MarketError::MarketOrderSizeError
        );

        let base_lots = max_base_size / market.base_lot_size;

        match side {
            Side::Bid => {
                let amount_to_lock = price
                    .checked_mul(base_lots)
                    .ok_or(MarketError::MathOverflow)?
                    .checked_mul(market.quote_lot_size)
                    .ok_or(MarketError::MathOverflow)?;

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
                open_order.quote_locked = open_order
                    .quote_locked
                    .checked_add(amount_to_lock)
                    .ok_or(MarketError::MathOverflow)?;
            }
            Side::Ask => {
                let amount_to_lock = base_lots
                    .checked_mul(market.base_lot_size)
                    .ok_or(MarketError::MathOverflow)?;
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

        let slab = match side {
            Side::Ask => &mut ctx.accounts.asks,
            Side::Bid => &mut ctx.accounts.bids,
        };
        let order_id = Clock::get()?.unix_timestamp as u128;

        Slab::insert_order(slab, order_id, base_lots, ctx.accounts.owner.key(), price)?;
        let created_order = Order {
            order_type,
            side,
            quantity: base_lots,
            order_id,
            client_order_id,
            price,
        };

        OpenOrders::push_order(&mut ctx.accounts.open_order, created_order)?;
        if matches!(order_type, OrderType::ImmediateOrCancel) {
            match_orders(
                &mut ctx.accounts.asks,
                &mut ctx.accounts.bids,
                &mut ctx.accounts.event_queue,
            )?;
        }
        Ok(())
    }
    pub fn cancel_order (
        ctx: Context<CancelOrder>,
        order_id: u64
    )->Result<()>{
        let open_order = &mut ctx.accounts.open_order;
        let market = &mut ctx.accounts.market;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    // Market account
    #[account(init, payer = admin, space = 8 + Market::INIT_SPACE)]
    pub market: Account<'info, Market>,

    // Orderbook slabs
    #[account(init, payer = admin, space = 8 + Slab::INIT_SPACE)]
    pub bids: Account<'info, Slab>,

    #[account(init, payer = admin, space = 8 + Slab::INIT_SPACE)]
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

    #[account(mut)]
    pub asks: Account<'info, Slab>,

    #[account(mut)]
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
    pub  market : Account<'info,Market>,

    #[account(
        mut,
        seeds = [b"open_order",market.key().as_ref(),owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = market
    )]
    pub open_order: Account<'info, OpenOrders>,

    #[account(mut)]
    pub slab : Account<'info,Slab>,

    #[account(mut)]
    pub event_queue : Account<'info,EventQueue>,

    #[account(mut)]
    pub bids : Account<'info,Slab>,

    #[account(mut)]
    pub asks : Account<'info,Slab>,

    #[account(mut)]
    pub quote_vault : Account<'info,AnchorTokenAccount>,

    #[account(mut)]
    pub base_vault : Account<'info,AnchorTokenAccount>,

    #[account(mut)]
    pub user_base_vault: Account<'info, AnchorTokenAccount>,

    #[account(mut)]
    pub user_quote_vault: Account<'info, AnchorTokenAccount>,

    pub owner : Signer<'info>,
    pub token_program : Program<'info,Token>
}
