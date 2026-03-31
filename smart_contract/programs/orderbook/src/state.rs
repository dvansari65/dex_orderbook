use anchor_lang::prelude::*;
use anchor_lang::{AnchorSerialize, AnchorDeserialize};
use crate::states::order_schema::{ enums::Side};

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub global_seq: u64,
    pub next_order_id:u64,          // order id better than unix time stamp
    pub base_mint: Pubkey,          // Mint of base token (e.g., SOL)
    pub quote_mint: Pubkey,         // Mint of quote token (e.g., USDC)
    
    pub base_vault: Pubkey,         // Vault for base token escrow
    pub quote_vault: Pubkey,        // Vault for quote token escrow

    pub bids: Pubkey,               // Slab account holding bid orders
    pub asks: Pubkey,               // Slab account holding ask orders
    pub event_queue: Pubkey,        // Event queue account

    pub base_lot_size: u64,         // Smallest tradeable amount in base token (like 0.0001 SOL)
    pub quote_lot_size: u64,        // Smallest price unit in quote token

    pub maker_fees_bps:u64,
    pub taker_fees_bps : u64,       // Fee in basis points (e.g., 20 = 0.2%)
    pub admin: Pubkey,              // Authority who can update market params

    pub vault_signer_nonce: u8,     // Nonce for vault PDA derivation
    pub market_status: u8,          // 0 = inactive, 1 = active, 2 = paused

    pub min_order_size: u64,        // Minimum order size in base lots
    pub max_orders_per_user: u16,   // Limits spamming orders

    pub padding: [u8; 64],          // Reserved space for future upgrades
    #[max_len(32)] 
    pub trader_entry:Vec<TraderEntry>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct TraderEntry {
    pub trader_key:Pubkey,
    pub trader_state:TraderState
}

#[account]
#[derive(InitSpace,Debug)]
pub struct Slab {
    pub head_index : u32,   // Index of the first free slot
    pub free_list_len : u32,   // Number of free slots available
    pub leaf_count : u32,
    #[max_len(32)]
    pub nodes:Vec<Node>    //dynamic array
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone,InitSpace,Debug)]
pub struct Node {
    pub price: u64,            // Price scaled by quote lot size
    pub quantity: u64,         // unfilled qty
    pub owner: Pubkey,         // User who placed the order
    pub client_order_id: u64,  // Optional client reference
    pub timestamp: i64,        // Unix timestamp of order placement
    pub order_id:u64,
    pub order_status : OrderStatus, //order status which can be filled or partially filled
    pub next: u32,             // Next node index (linked list)
    pub prev: u32,             // Previous node index
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug,PartialEq)]
pub enum OrderType {
    Limit,
    ImmediateOrCancel,
    PostOnly
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum OrderStatus {
    Fill = 1,
    PartialFill = 2,
    Open = 3,
    Cancel = 4
}

// Event queue structures for on-chain storage

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum EventType {
    Place = 0,
    Fill = 1,
    PartialFill = 2,
    Cancel = 3,
    Reduce = 4,
    Evict = 5,
    Expire = 6,
    FeeCollected = 7,
    TimeInForce = 8,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct QueueEvent {
    pub global_seq: u64,      // ordering guarantee for indexer
    pub maker_order_id: u64,
    pub event_type: EventType,
    pub order_id: u64,
    pub owner: Pubkey,
    pub counterparty: Pubkey,
    pub side: Side,
    pub price: u64,
    pub base_quantity: u64,
    pub client_order_id: u64,
    pub timestamp: i64,
    pub market_pubkey: Pubkey,
    pub taker_remaining_qty:u64,
    pub maker_remaining_qty:u64
}


#[account]
#[derive(InitSpace,Debug)]
pub struct EventQueue {
    pub head: u32,
    pub tail: u32,
    pub count: u32,
    #[max_len(28)]    
    pub events: Vec<QueueEvent>,
}


pub struct MatchResult {
    pub maker_qty:u64 , // this is maker's remained qty after order matching
    pub taker_qty:u64,  // this is taker's remained qty after order matching
    pub execution_price:u64,
    pub counter_party:Pubkey
}
pub enum MatchOutcome {
    NoMatch(&'static str),   // reason why no match happened
    Matched(MatchResult),     // actual result
}

#[derive(Clone, Copy)]
pub struct OrderParams {
    pub base_qty: u64,
    pub price: u64,
    pub order_type: OrderType,
    pub client_order_id: u64,
    pub side: Side,
}

#[derive(Clone, Copy)]
pub struct LockResult {
    pub base_lots: u64,
    pub quote_lots: u64,
    pub amount_locked: u64,
}

pub struct FillRecord {
    pub maker_order_id: u64,
    pub maker_owner: Pubkey,
    pub fill_qty: u64,
    pub execution_price: u64,
    pub maker_fully_filled: bool,
    pub maker_remaining_qty: u64,
}

#[repr(C)]
#[derive(Debug,Clone,AnchorSerialize, AnchorDeserialize, InitSpace)]
pub struct TraderState{
    pub quote_lots_locked:u64,
    pub quote_lots_free:u64,
    pub base_lots_free:u64,
    pub base_lots_locked:u64,
}

impl Market {
    pub fn get_trader_entry(&mut self,trader_key:&Pubkey)->Option<&mut TraderEntry>{
           let  entry =  self.trader_entry
                    .iter_mut()
                    .find(|entry| entry.trader_key == *trader_key);
            return entry;
    }

}