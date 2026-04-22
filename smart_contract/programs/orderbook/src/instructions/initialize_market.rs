use anchor_lang::prelude::*;
use crate::*;

pub fn handler(
    ctx: Context<InitializeMarket>,
    base_lot_size: u64,
    quote_lot_size: u64,
    maker_fees_bps: u64,
    taker_fees_bps: u64,
) -> Result<()> {
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

    market.admin = ctx.accounts.admin.key();
    market.base_mint = ctx.accounts.base_mint.key();
    market.quote_mint = ctx.accounts.quote_mint.key();

    market.bids = bids.key();
    market.asks = asks.key();

    market.base_vault = ctx.accounts.base_vault.key();
    market.quote_vault = ctx.accounts.quote_vault.key();

    market.base_lot_size = base_lot_size;
    market.quote_lot_size = quote_lot_size;

    market.maker_fees_bps = maker_fees_bps;
    market.taker_fees_bps = taker_fees_bps;

    market.vault_signer_nonce = ctx.bumps.vault_signer;

    market.market_status = 1;
    market.max_orders_per_user = 100;
    market.min_order_size = base_lot_size;

    Ok(())
}