use anchor_lang::prelude::*;

#[event]
pub struct OrderFilledEvent {
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub price: u64,
    pub quantity: u64,
}

pub struct  CancelOrderEvent {
    
}