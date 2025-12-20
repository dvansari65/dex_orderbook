use anchor_lang::prelude::*;
use anchor_lang::{AnchorSerialize, AnchorDeserialize};
use crate::events::OrderFillEvent;
use crate::states::order_schema::{self, enums::Side};

#[account]
#[derive(InitSpace)]
pub struct Market {
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub enum OrderType {
    Limit,
    ImmediateOrCancel,
    PostOnly
}

#[account]
#[derive(InitSpace,Debug)]
pub struct OpenOrders {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub base_free: u64,
    pub base_locked: u64,
    pub quote_free: u64,
    pub quote_locked: u64,
    #[max_len(16)] // Max orders
    pub orders: Vec<Order>, 
    pub orders_count: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct Order {
    pub order_type:OrderType,
    pub order_id: u64,
    pub side: Side,
    pub price: u64,
    pub owner: Pubkey, 
    pub quantity: u64,
    pub client_order_id: u64,
    pub order_status:OrderStatus
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum OrderStatus {
    Fill = 1,
    PartialFill = 2,
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
    pub event_type: EventType,
    pub order_id: u64,
    pub owner: Pubkey,
    pub counterparty: Pubkey,
    pub side: Side,
    pub price: u64,
    pub base_quantity: u64,
    pub client_order_id: u64,
    pub timestamp: i64,
}

#[account]
#[derive(InitSpace,Debug)]
pub struct EventQueue {
    pub head: u32,
    pub tail: u32,
    pub count: u32,
    #[max_len(32)]
    pub events: Vec<QueueEvent>,
}


