use anchor_lang::prelude::*;

#[error_code]
pub enum OrderError {
    #[msg("Insufficient balance")]
    BalanceError,
    #[msg("Order book full!")]
    OrderbookFull,
    #[msg("order not found!")]
    OrderNotFound,
    #[msg("Orders exceeded!")]
    OrderFull,
}

#[error_code]
pub enum MarketError {
    #[msg("Market is paused!")]
    MarketActiveError,
    #[msg("Max base size should be greater than minimum order size!")]
    MarketOrderSizeError,
    #[msg("Value overflowed!")]
    MathOverflow,
    #[msg("No orders")]
    NoOrders
}

