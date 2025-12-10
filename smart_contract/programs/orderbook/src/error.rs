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
    #[msg("No free space for the order!")]
    NoSpace
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

#[error_code]
pub enum OpenOrderError {
    #[msg("Order not found!")]
    OrderNotFound
}


#[error_code]
pub enum EventError {
   #[msg("Order not found in event queue!")]
   OrderNotFound
}

#[error_code]
pub enum SlabError {
    #[msg("Order not found in the Slab!")]
    OrderNotFound
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized request!")]
    UnAuthorized,
    #[msg("removed order not matched with order from the slab!")]
    MisMatchedOrder,
    #[msg("Under flow error!")]
    UnderFlow,
    #[msg("Over flow error!")]
    OverFlow
}

#[error_code]
pub enum EventQueueError {
    #[msg("Queue full!")]
    QueueFull
}