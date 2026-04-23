use crate::states::order_schema::enums::Side;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint as AnchorMint, Token, TokenAccount as AnchorTokenAccount};
declare_id!("2BRNRPFwJWjgRGV3xeeudGsi9mPBQHxLWFB6r3xpgxku");

pub mod assets;
pub mod calculate;
pub mod error;
pub mod events;
pub mod helpers;
pub mod instructions;
pub mod state;
pub mod states;
use state::*;

#[program]
pub mod orderbook {
    use super::*;

    pub fn initialise_market(
        ctx: Context<InitializeMarket>,
        base_lot_size: u64,
        quote_lot_size: u64,
        maker_fees_bps: u64,
        taker_fees_bps: u64,
    ) -> Result<()> {
        instructions::initialize_market::handler(
            ctx,
            base_lot_size,
            quote_lot_size,
            maker_fees_bps,
            taker_fees_bps,
        )
    }

    pub fn place_limit_order(
        ctx: Context<PlaceLimitOrder>,
        max_base_size: u64,
        client_order_id: u64,
        price: u64,
        order_type: OrderType,
        side: Side,
    ) -> Result<()> {
        instructions::place_limit::handler(
            ctx,
            max_base_size,
            client_order_id,
            price,
            order_type,
            side,
        )
    }

    pub fn place_ioc_order(
        ctx: Context<PlaceIOCOrder>,
        base_qty: u64,
        price_in_raw_units: u64,
        order_type: OrderType,
        side: Side,
    ) -> Result<()> {
        instructions::place_ioc::handler(
            ctx,
            base_qty,
            price_in_raw_units,
            order_type,
            side,
        )
    }

    pub fn place_post_only_order(
        ctx: Context<PlacePostOnlyOrder>,
        base_qty: u64,
        price_in_raw_units: u64,
        order_type: OrderType,
        client_order_id: u64,
        side: Side,
    ) -> Result<()> {
        instructions::place_post_only::handler(
            ctx,
            base_qty,
            price_in_raw_units,
            order_type,
            client_order_id,
            side,
        )
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, order_id: u64, side: Side) -> Result<()> {
        instructions::cancel_order::handler(ctx, order_id, side)
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

    #[account(mut)]
    pub user_base_vault: Account<'info, AnchorTokenAccount>,
    #[account(mut)]
    pub user_quote_vault: Account<'info, AnchorTokenAccount>,
    pub token_program: Program<'info, Token>,
}
