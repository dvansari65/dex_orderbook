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
    NoSpace,
    #[msg("Quantity underflow!")]
    UnderFlow,
    #[msg("Quantity Overflow!")]
    OverFlow,
    #[msg("Failed to get first order!")]
    InvalidNode,
    #[msg("Order can be match , So rejecting the order!")]
    WouldMatchImmediately
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
    NoOrders,
    #[msg("Order id overflow!")]
    OrderIdOverFlow,
    #[msg("insufficient balance!")]
    InsufficientQuoteBalance,
    #[msg("insufficient balance!")]
    InsufficientBaseBalance,
    #[msg("Invalid token owner!")]
    InvalidTokenAccountOwner,
    #[msg("Invalid token Mint!")]
    InvalidTokenMint,
    #[msg("Destination vault is uninitialise!")]
    DestinationVaultUninitialized,
    #[msg("Invalid market account!")]
    InvalidMarketAccount

}


#[error_code]
pub enum OpenOrderError {
    #[msg("Order not found!")]
    OrderNotFound,
    #[msg("Order overflow error!")]
    OrderOverFlow,
    #[msg("Price should not be 0")]
    PriceIsTooLow
}


#[error_code]
pub enum EventError {
   #[msg("Order not found in event queue!")]
   OrderNotFound
}

#[error_code]
pub enum SlabError {
    #[msg("Order not found in the Slab!")]
    OrderNotFound,
    #[msg("Invalid quantity!")]
    InvalidQty,
    #[msg("Invalid price!")]
    InvalidPrice,
    #[msg("Duplicate order id!")]
    DuplicateOrderId,
    #[msg("Invalid inserting index!")]
    InvalidIndex,
    #[msg("Quantity underflow!")]
    UnderFlow,
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
    OverFlow,
    #[msg("Invalid price!")]
    InvalidPrice
}

#[error_code]
pub enum EventQueueError {
    #[msg("Queue full!")]
    QueueFull
}
