use anchor_lang::Result;

use crate::{error::MarketError, state::Market};

pub fn calculate_lots(market: &Market, base_qty: u64, price: u64) -> Result<(u64, u64)> {
    let base_lots = base_qty / market.base_lot_size;
    let quote_lots = price
        .checked_div(market.quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    Ok((base_lots, quote_lots))
}

pub fn calculate_bid_lock_amount(
    quote_lots: u64,
    base_lots: u64,
    quote_lot_size: u64,
) -> Result<u64> {
    let quote = quote_lots
        .checked_mul(base_lots)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    Ok(quote)
}

pub fn calculate_ask_lock_amount(base_lots: u64, base_lot_size: u64) -> Result<u64> {
    let base_lots = base_lots
        .checked_mul(base_lot_size)
        .ok_or(MarketError::MathOverflow)?;
    Ok(base_lots)
}
