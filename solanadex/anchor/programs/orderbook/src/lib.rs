use anchor_lang::prelude::*;

declare_id!("JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H");

#[program]
pub mod orderbook {
    use super::*;

    pub fn initialise_market(_ctx: Context<InitializeMarket>) -> Result<()> {
        msg!("GM!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct  InitializeMarket<'info> {
    #[account(init, payer = admin , space = 8 + Market::INIT_SPACE)]
    pub market : Account<'info,Market>,

    #[account(init,payer = admin , space = 8 + Slab::INIT_SPACE)]
    pub bids : Account<'info,Slab>,
    #[account(mut)]
    pub admin : Signer<'info>,
    pub system_program : Program<'info,System>
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub base_mint: Pubkey,          // Mint of base token (e.g., SOL)
    pub quote_mint: Pubkey,         // Mint of quote token (e.g., USDC)
    
    pub base_vault: Pubkey,         // Vault for base token escrow
    pub quote_vault: Pubkey,        // Vault for quote token escrow

    pub bids: Pubkey,               // Slab account holding bid orders
    pub asks: Pubkey,               // Slab account holding ask orders
    pub event_queue: Pubkey,        // Event queue account

    pub base_lot_size: u64,         // Smallest tradeable amount in base token (like 0.0001 SOL)
    pub quote_lot_size: u64,        // Smallest price unit in quote token

    pub fee_rate_bps: u16,          // Fee in basis points (e.g., 20 = 0.2%)
    pub admin: Pubkey,              // Authority who can update market params

    pub vault_signer_nonce: u8,     // Nonce for vault PDA derivation
    pub market_status: u8,          // 0 = inactive, 1 = active, 2 = paused

    pub min_order_size: u64,        // Minimum order size in base lots
    pub max_orders_per_user: u16,   // Limits spamming orders

    pub padding: [u8; 64],          // Reserved space for future upgrades
}


#[account]
#[derive(InitSpace)]
pub struct Slab {
    pub head_index : u32,   // Index of the first free slot
    pub free_list_len : u32,   // Number of free slots available
    pub leaf_count : u32,
    #[max_len(1024)] 
    pub nodes:Vec<Node>    //dynamic array
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone,InitSpace)]
pub struct Node {
    pub price: u64,            // Price scaled by quote lot size
    pub quantity: u64,         // Quantity in base lots
    pub owner: Pubkey,         // User who placed the order
    pub client_order_id: u64,  // Optional client reference
    pub timestamp: i64,        // Unix timestamp of order placement

    pub next: u32,             // Next node index (linked list)
    pub prev: u32,             // Previous node index
}

