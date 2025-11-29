use anchor_lang::prelude::*;

#[error_code]
pub enum OrderError {
    #[msg("Insufficient balance")]
    BalanceError
}

#[error_code]
pub enum MarketError {
    #[msg("Market is paused!")]
    MarketActiveError,
    #[msg("Max base size should be greater than minimum order size!")]
    MarketOrderSizeError
}

