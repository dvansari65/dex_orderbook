use std::u32;

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Transfer};

use crate::ConsumeEvent;
use crate::error::{ConsumeEventsError, EventError, MarketError, OpenOrderError, OrderError, SlabError};
use crate::state::{
    EventQueue, FillRecord, Market, OrderStatus, OrderType, QueueEvent
};

use crate::state::{Node, OpenOrders, Order, Slab};
use crate::states::order_schema::enums::Side;
impl Slab {
    pub fn insert_order(
        &mut self,
        order_id: u64,
        order_type: &OrderType,
        quantity: u64,
        owner: Pubkey,
        price: u64,
        order_status: OrderStatus,
        client_order_id: u64,
        market: &Pubkey,
        side: Side,
    ) -> Result<()> {
        require!(self.nodes.len() < 32, OrderError::OrderbookFull);
        require!(self.free_list_len > 0, OrderError::NoSpace);
        require!(quantity > 0, SlabError::InvalidQty);
        require!(price > 0, SlabError::InvalidPrice);
        require!(
            !self.nodes.iter().any(|n| n.order_id == order_id),
            SlabError::DuplicateOrderId
        );
        require!(
            *market != Pubkey::default(),
            MarketError::InvalidMarketAccount
        );
        if *order_type == OrderType::ImmediateOrCancel {
            msg!("This order tye can not pushed into the slab!");
            return Ok(());
        }
        let new_node = Node {
            price,
            quantity,
            owner,
            order_id,
            client_order_id,
            timestamp: Clock::get()?.unix_timestamp,
            next: u32::MAX,
            prev: u32::MAX,
            order_status,
        };

        let insert_position = self.find_insert_position(price, side)?;
        msg!("insert position:{:?}", insert_position);
        if insert_position == self.nodes.len() {
            self.nodes.push(new_node);
            self.free_list_len -= 1;
        } else {
            self.nodes.insert(insert_position, new_node);
            self.free_list_len -= 1;
        }
        self.update_links(insert_position)?;
        self.leaf_count += 1;
        msg!(
            "Order inserted: {} @ price {} (total orders: {})",
            quantity,
            price,
            self.leaf_count
        );
        msg!("slab data:{:?}", self.nodes);
        msg!("Event emission completed");
        Ok(())
    }

    pub fn find_insert_position(&self, price: u64, side: Side) -> Result<usize> {
        for (i, node) in self.nodes.iter().enumerate() {
            match side {
                Side::Ask => {
                    if price < node.price {
                        return Ok(i);
                    }
                }
                Side::Bid => {
                    if price > node.price {
                        return Ok(i);
                    }
                }
            }
        }
        Ok(self.nodes.len())
    }
    pub fn update_links(&mut self, inserted_index: usize) -> Result<()> {
        let len = self.nodes.len();
        require!(inserted_index < len, SlabError::InvalidIndex);

        if len == 1 {
            self.nodes[0].prev = u32::MAX;
            self.nodes[0].next = u32::MAX;
            return Ok(());
        }

        if inserted_index == 0 {
            self.nodes[inserted_index].prev = u32::MAX;
            self.nodes[inserted_index].next = (inserted_index as u32) + 1;
            self.nodes[inserted_index + 1].prev = 0;
            return Ok(());
        }

        if inserted_index == len - 1 {
            self.nodes[inserted_index].next = u32::MAX;
            self.nodes[inserted_index].prev = (inserted_index as u32) - 1;
            self.nodes[inserted_index - 1].next = inserted_index as u32;
            msg!("Inserted at tail");
            return Ok(());
        }

        let next_index = inserted_index + 1;
        let prev_index = inserted_index - 1;

        self.nodes[inserted_index].next = next_index as u32;
        self.nodes[inserted_index].prev = prev_index as u32;
        self.nodes[prev_index].next = inserted_index as u32;
        self.nodes[next_index].prev = inserted_index as u32;
        msg!(
            "Inserted in middle: {} -> {} -> {}",
            prev_index,
            inserted_index,
            next_index
        );
        Ok(())
    }
    pub fn update_links_after_removing(&mut self, removed_index: usize) -> Result<()> {
        let len = self.nodes.len();

        // Boundary checks
        if removed_index >= len && len > 0 {
            // If removed_index is at the end, update the previous node
            if removed_index > 0 && removed_index == len {
                // The last node was removed, update the new last node
                self.nodes[removed_index - 1].next = u32::MAX; // No next node
            }
            return Ok(());
        }

        // Update links for nodes around the removed position
        if removed_index > 0 && removed_index < len {
            // Link previous to current (which shifted down)
            self.nodes[removed_index - 1].next = removed_index as u32;
            self.nodes[removed_index].prev = (removed_index - 1) as u32;
        } else if removed_index == 0 && len > 0 {
            // First node was removed, update the new first node
            self.nodes[0].prev = u32::MAX; // or 0, depending on your sentinel
        }

        Ok(())
    }
    pub fn remove_order(&mut self, order_id: &u64) -> Result<Node> {
        let position = self
            .nodes
            .iter()
            .position(|n| n.order_id == *order_id as u64)
            .ok_or(OrderError::OrderNotFound)?;

        let removed_node = self.nodes.remove(position);
        self.leaf_count -= 1;
        msg!("Order {} removed!", order_id);
        self.update_links_after_removing(position)?;
        Ok(removed_node)
    }
    /// Get best order (for matching)
    pub fn get_best_order(&self) -> Option<&Node> {
        // First node is best (already sorted)
        self.nodes.first()
    }
    pub fn get_orders_by_owner(&self, owner: &Pubkey) -> Vec<Node> {
        self.nodes
            .iter()
            .filter(|n| n.owner == *owner)
            .cloned()
            .collect()
    }
    pub fn get_order_by_id(&mut self, order_id: u64) -> Result<Option<&Node>> {
        let position = self
            .nodes
            .iter()
            .position(|n| n.order_id == order_id)
            .ok_or(SlabError::OrderNotFound)?;

        let order = self.nodes.get(position);
        msg!("order find by ID: {:?}", order);
        Ok(order)
    }
}

impl OpenOrders {
    pub fn push_order(&mut self, order: Order) -> Result<Order> {
        const MAX_ORDERS: usize = 16;
        if self.orders.len() >= MAX_ORDERS {
            msg!("Orders full!");
            return Err(OrderError::OrderFull.into());
        }
        if order.price == 0 {
            msg!("Order price should be greater than 0!");
            return Err(OpenOrderError::PriceIsTooLow.into());
        }

        self.orders.push(order);
        self.orders_count = self
            .orders_count
            .checked_add(1)
            .ok_or(OpenOrderError::OrderOverFlow)?;
        Ok(order)
    }

    pub fn update_open_order_assets() -> Result<()> {
        Ok(())
    }

    pub fn remove_order(&mut self, order_id: u64) -> Result<&mut OpenOrders> {
        let position = self
            .orders
            .iter()
            .position(|n| n.order_id == order_id)
            .ok_or(OpenOrderError::OrderNotFound)?;
        self.orders.remove(position);
        self.orders_count -= 1;
        Ok(self)
    }
}

// Checks whether a PostOnly order would match immediately.
// Returns true  → order WOULD cross → reject it.
// Returns false → order is safe → insert into book.
// Pure read — does not mutate anything.
pub fn would_match_post_only(
    side: Side,
    order_price: u64,
    asks: &Slab,
    bids: &Slab,
) -> bool {
    match side {
        Side::Ask => bids
            .nodes
            .first()
            .map_or(false, |best_bid| order_price <= best_bid.price),
        Side::Bid => asks
            .nodes
            .first()
            .map_or(false, |best_ask| order_price >= best_ask.price),
    }
}


impl EventQueue {
    pub const CAPACITY: usize = 32;
    pub fn get_event_by_order_id(&mut self, order_id: &u64) -> Result<Option<&QueueEvent>> {
        let event_position = self
            .events
            .iter()
            .position(|n| n.order_id == *order_id)
            .ok_or(EventError::OrderNotFound)?;

        let event = self.events.get(event_position);
        Ok(event)
    }
    pub fn insert_event(&mut self, event: QueueEvent) -> Result<()> {
        if self.count == Self::CAPACITY as u32 {
            self.tail = (self.tail + 1) % Self::CAPACITY as u32;
        } else {
            self.count += 1;
        }

        if self.events.len() < Self::CAPACITY {
            self.events.push(event);
        } else {
            self.events[self.head as usize] = event;
        }

        self.head = (self.head + 1) % Self::CAPACITY as u32;
        Ok(())
    }
    pub fn pop_front(&mut self) -> Option<QueueEvent> {
        if self.count == 0 {
            return None;
        }
        let event = self.events[self.tail as usize].clone();
        self.tail = (self.tail + 1) % Self::CAPACITY as u32;
        self.count -= 1;
        Some(event)
    }

    pub fn peek(&self) -> Option<&QueueEvent> {
        if self.count == 0 {
            return None;
        }
        Some(&self.events[self.tail as usize])
    }
}

pub fn create_order(
    order_type: OrderType,
    side: Side,
    base_lots: u64,
    owner: Pubkey,
    order_id: u64,
    client_order_id: u64,
    quote_lots: u64,
    status: OrderStatus,
) -> Order {
    Order {
        order_type,
        side,
        quantity: base_lots,
        owner,
        order_id,
        client_order_id,
        price: quote_lots,
        order_status: status,
    }
}

pub fn get_next_order_id(market: &mut Market) -> Result<u64> {
    let order_id = market.next_order_id;
    market.next_order_id = market
        .next_order_id
        .checked_add(1)
        .ok_or(MarketError::OrderIdOverFlow)?;
    Ok(order_id)
}

pub fn get_order_book_sides<'info>(
    asks: &'info mut Account<'info, Slab>,
    bids: &'info mut Account<'info, Slab>,
    side: Side,
) -> (&'info mut Account<'info, Slab>, &'info mut Account<'info, Slab>) {
    match side {
        Side::Ask => (asks, bids),
        Side::Bid => (bids, asks),
    }
}

// Match taker order against the opposite slab.
// Mutates order.quantity and slab nodes in place.
// Returns all fills that occurred.
// Caller handles: credit_fill(), dispatch_fill_event(), slab insert.
pub fn try_match(
    side: Side,
    order: &mut Order,
    opposite_slab: &mut Slab,
) -> Result<Vec<FillRecord>> {
    let mut fills: Vec<FillRecord> = Vec::new();

    while !opposite_slab.nodes.is_empty() && order.quantity > 0 {
        let fill = {
            let best = opposite_slab
                .nodes
                .first_mut()
                .ok_or(OrderError::InvalidNode)?;

            let can_match = match side {
                Side::Ask => order.price <= best.price,
                Side::Bid => order.price >= best.price,
            };

            if !can_match {
                break;
            }

            let fill_qty = best.quantity.min(order.quantity);
            let execution_price = best.price;

            best.quantity = best
                .quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;

            order.quantity = order
                .quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;

            FillRecord {
                maker_order_id: best.order_id,
                maker_owner: best.owner,
                fill_qty,
                execution_price,
                maker_fully_filled: best.quantity == 0,
                maker_remaining_qty: best.quantity,
            }
        };

        if fill.maker_fully_filled {
            opposite_slab.remove_order(&fill.maker_order_id)?;
        }

        fills.push(fill);
    }
    Ok(fills)
}

pub fn try_match_ioc(
    side: Side,
    order: &mut Order,
    opposite_slab: &mut Slab,
) -> Result<Option<FillRecord>> {
    if opposite_slab.nodes.is_empty() {
        return Ok(None);
    }

    let best = opposite_slab
        .nodes
        .first_mut()
        .ok_or(OrderError::InvalidNode)?;

    let can_match = match side {
        Side::Ask => order.price <= best.price,
        Side::Bid => order.price >= best.price,
    };

    if !can_match {
        return Ok(None);
    }

    let fill_qty = best.quantity.min(order.quantity);
    let execution_price = best.price;

    best.quantity = best
        .quantity
        .checked_sub(fill_qty)
        .ok_or(OrderError::UnderFlow)?;

    order.quantity = order
        .quantity
        .checked_sub(fill_qty)
        .ok_or(OrderError::UnderFlow)?;

    let fill = FillRecord {
        maker_order_id: best.order_id,
        maker_owner: best.owner,
        fill_qty,
        execution_price,
        maker_fully_filled: best.quantity == 0,
        maker_remaining_qty: best.quantity,
    };

    if fill.maker_fully_filled {
        opposite_slab.remove_order(&fill.maker_order_id)?;
    }

    Ok(Some(fill))
}

pub fn settle_fill(
    ctx: &Context<ConsumeEvent>,
    event: &QueueEvent,
    market: &Market,
    signer_seeds: &[&[&[u8]]; 1],
) -> Result<()> {
    // Verify taker accounts
    require!(
        ctx.accounts.taker_base_account.key() 
            == get_associated_token_address(&event.owner, &market.base_mint),
        ConsumeEventsError::InvalidTakerBaseAta
    );
    require!(
        ctx.accounts.taker_quote_account.key() 
            == get_associated_token_address(&event.owner, &market.quote_mint),
        ConsumeEventsError::InvalidTakerQuoteAta
    );

    // Verify maker accounts
    require!(
        ctx.accounts.maker_base_account.key() 
            == get_associated_token_address(&event.counterparty, &market.base_mint),
        ConsumeEventsError::InvalidMakerBaseAta
    );
    require!(
        ctx.accounts.maker_quote_account.key() 
            == get_associated_token_address(&event.counterparty, &market.quote_mint),
        ConsumeEventsError::InvalidMakerQuoteAta
    );

    // Calculate amounts
    let base_raw = event
        .base_quantity
        .checked_mul(market.base_lot_size)
        .ok_or(ConsumeEventsError::MathOverflow)?;

    let quote_raw = event
        .base_quantity
        .checked_mul(event.price)
        .ok_or(ConsumeEventsError::MathOverflow)?
        .checked_mul(market.quote_lot_size)
        .ok_or(ConsumeEventsError::MathOverflow)?;

    // Execute transfers based on taker side
    match event.side {
        Side::Bid => {
            // Taker bought base: vault -> taker base, vault -> maker quote
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.base_vault.to_account_info(),
                        to: ctx.accounts.taker_base_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                base_raw,
            )?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.quote_vault.to_account_info(),
                        to: ctx.accounts.maker_quote_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                quote_raw,
            )?;
        }
        Side::Ask => {
            // Taker sold base: vault -> taker quote, vault -> maker base
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.quote_vault.to_account_info(),
                        to: ctx.accounts.taker_quote_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                quote_raw,
            )?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.base_vault.to_account_info(),
                        to: ctx.accounts.maker_base_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                base_raw,
            )?;
        }
    }

    Ok(())
}


pub fn settle_cancel(
    ctx: &Context<ConsumeEvent>,
    event: &QueueEvent,
    market: &Market,
    signer_seeds: &[&[&[u8]]; 1],
) -> Result<()> {
    // Cancel only has one party - the owner who cancelled
    // Verify taker accounts (owner's accounts)
    require!(
        ctx.accounts.taker_base_account.key() 
            == get_associated_token_address(&event.owner, &market.base_mint),
        ConsumeEventsError::InvalidOwnerBaseAta
    );
    require!(
        ctx.accounts.taker_quote_account.key() 
            == get_associated_token_address(&event.owner, &market.quote_mint),
        ConsumeEventsError::InvalidOwnerQuoteAta
    );

    // Calculate return amount from remaining qty
    let return_amount = event
        .taker_remaining_qty
        .checked_mul(match event.side {
            Side::Bid => event.price.checked_mul(market.quote_lot_size),
            Side::Ask => Some(market.base_lot_size),
        }.ok_or(ConsumeEventsError::MathOverflow)?)
        .ok_or(ConsumeEventsError::MathOverflow)?;

    // Return locked funds based on side
    match event.side {
        Side::Bid => {
            // Locked quote, return quote
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.quote_vault.to_account_info(),
                        to: ctx.accounts.taker_quote_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                return_amount,
            )?;
        }
        Side::Ask => {
            // Locked base, return base
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.base_vault.to_account_info(),
                        to: ctx.accounts.taker_base_account.to_account_info(),
                        authority: ctx.accounts.vault_signer.to_account_info(),
                    },
                    signer_seeds,
                ),
                return_amount,
            )?;
        }
    }

    Ok(())
}
