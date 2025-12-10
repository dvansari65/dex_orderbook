use anchor_lang::prelude::*;

#[event]
pub struct OrderFilledEvent {
    pub order_id : u128 , 
    pub event_type : u8 ,
    pub price : u64,
    pub quantity: u64,
    pub maker : Pubkey,  // maker which provides liquidity
    pub taker : Pubkey,  // taker which removes liquidity
    pub timestamp : u64
}

#[event]
pub struct OrderCancelledEvent {  // ← Add "Event" suffix
    pub order_id: u128,
    pub price: u64,
    pub quantity: u64,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub timestamp: u64,
}

