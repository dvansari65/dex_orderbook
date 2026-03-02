use std::u32;

use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;

use crate::error::{EventError, MarketError, OpenOrderError, OrderError, SlabError};
use crate::{ConsumeEvents, events::*};
use crate::state::{
    EventQueue, EventType, MatchOutcome, MatchResult, OrderStatus, OrderType, QueueEvent,
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

pub fn match_orders(
    side: Side,
    order: &mut Order,
    opposite_slab: &mut Slab,
    market_pubkey: &Pubkey,
    event_queue: &mut EventQueue,
) -> Result<MatchOutcome> {
    // 1. Identify the correct side to match against
    let mut total_quote_qty = 0u64;
    let mut maker_qty_remained = 0u64;
    let mut filled_price = 0u64; // price at which order get placed
    let mut maker_key = Default::default();
    while !opposite_slab.nodes.is_empty() && order.quantity > 0 {
        // We scope the borrow of 'best_opposite' so we can drop it before calling 'remove_order'
        let (fill_qty, execution_price, maker_id, maker_owner, maker_filled, quantity_remained) = {
            let best_opposite = opposite_slab.nodes.first_mut().unwrap();
            maker_key = best_opposite.owner;
            // 3. Price Cross Check
            // A match only happens if the Taker's price "crosses" the Maker's price.
            let can_match = match side {
                Side::Ask => order.price <= best_opposite.price, // Selling for 10 into a Bid for 11
                Side::Bid => order.price >= best_opposite.price, // Buying for 10 into an Ask for 9
            };
            if !can_match {
                break;
            }
            let fill_qty = best_opposite.quantity.min(order.quantity);
            let execution_price = best_opposite.price; // Trade executes at the price already on the book
            msg!("execution price is {}", execution_price.to_string());
            // Update quantities in place
            best_opposite.quantity = best_opposite
                .quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;

            order.quantity = order
                .quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;
            let quantity_remained = best_opposite.quantity;
    
            (
                fill_qty,
                execution_price,
                best_opposite.order_id.clone(),
                best_opposite.owner,
                best_opposite.quantity == 0,
                quantity_remained,
            )
        };
        // 4. Calculate Quote Volume
        let quote_qty = fill_qty
            .checked_mul(execution_price)
            .ok_or(OrderError::OverFlow)?;
        // created this variable to return the filled quantity to get this qty in the instruction

        total_quote_qty = total_quote_qty
            .checked_add(quote_qty)
            .ok_or(OrderError::OverFlow)?;
        // 5. Emit Event & Update Status
        // We emit ONE event per match. Your indexer uses this to update both sides.
        let event_type = if maker_filled {
            EventType::Fill
        } else {
            EventType::PartialFill
        };
        if event_type == EventType::Fill {
            emit!(OrderFillEvent {
                maker: maker_owner,
                maker_order_id: maker_id,
                taker: order.owner,
                taker_order_id: order.order_id,
                side,
                price: execution_price,
                base_lots_filled: fill_qty,
                base_lots_remaining: quantity_remained,
                timestamp: Clock::get()?.unix_timestamp,
                market_pubkey: *market_pubkey
            });
            let removed_order = opposite_slab.remove_order(&maker_id)?;
            msg!(
                "order ID:{} removed from the Slab, Order status{:?}",
                removed_order.order_id,
                removed_order.order_status
            );
            msg!(
                "order fill event emitted from match order function:market key {} and maker key:{}",
                market_pubkey,
                maker_owner
            );
        } else {
            emit!(OrderPartialFillEvent {
                maker: maker_owner,
                maker_order_id: maker_id,
                taker: order.owner,
                taker_order_id: order.order_id,
                side,
                price: execution_price,
                base_lots_filled: fill_qty,
                base_lots_remaining: quantity_remained,
                timestamp: Clock::get()?.unix_timestamp,
                market_pubkey: *market_pubkey
            });
        }
        let event = QueueEvent {
            event_type,
            order_id: order.order_id.clone(),
            owner: order.owner,
            counterparty: maker_owner,
            side: side,
            price: execution_price,
            base_quantity: fill_qty,
            client_order_id: order.client_order_id,
            timestamp: Clock::get()?.unix_timestamp,
            market_pubkey: *market_pubkey,
        };
        event_queue.insert_event(event)?;
        maker_qty_remained = quantity_remained;
        filled_price = execution_price;
    }

    Ok(MatchOutcome::Matched(MatchResult {
        taker_qty: order.quantity,
        maker_qty: maker_qty_remained,
        execution_price: filled_price,
        counter_party:maker_key
    }))
}

pub fn match_post_only_orders(
    asks: &Slab,
    bids: &Slab,
    side: Side,
    order: &Order,
) -> Result<MatchOutcome> {
    match side {
        Side::Ask => {
            // Check if there are any bids to match against
            if bids.nodes.is_empty() {
                // No bids exist - order CANNOT match, so it's SAFE for post-only
                return Ok(MatchOutcome::NoMatch("No bids exist - order won't match"));
            }

            let best_bid = bids.nodes.first().ok_or(OrderError::InvalidNode)?;

            // For Ask (sell): order would match if price <= best_bid
            if order.price <= best_bid.price {
                // Order WOULD match immediately - REJECT for post-only
                msg!(
                    "Ask price {} <= best bid {} - would match immediately. REJECTING",
                    order.price,
                    best_bid.price
                );
                return Ok(MatchOutcome::Matched(MatchResult {
                    maker_qty: 0, // These can be 0 since we're just using Matched as rejection signal
                    taker_qty: 0,
                    execution_price: 0,
                    counter_party:best_bid.owner
                }));
            } else {
                // Order would NOT match - SAFE for post-only
                msg!(
                    "Ask price {} > best bid {} - won't match. ACCEPTING",
                    order.price,
                    best_bid.price
                );
                return Ok(MatchOutcome::NoMatch(
                    "Order won't match - safe for post-only",
                ));
            }
        }

        Side::Bid => {
            // Check if there are any asks to match against
            if asks.nodes.is_empty() {
                // No asks exist - order CANNOT match, so it's SAFE for post-only
                return Ok(MatchOutcome::NoMatch("No asks exist - order won't match"));
            }

            let best_ask = asks.nodes.first().ok_or(OrderError::InvalidNode)?;

            // For Bid (buy): order would match if price >= best_ask
            if order.price >= best_ask.price {
                // Order WOULD match immediately - REJECT for post-only
                msg!(
                    "Bid price {} >= best ask {} - would match immediately. REJECTING",
                    order.price,
                    best_ask.price
                );
                return Ok(MatchOutcome::Matched(MatchResult {
                    maker_qty: 0,
                    taker_qty: 0,
                    execution_price: 0,
                    counter_party:best_ask.owner
                }));
            } else {
                // Order would NOT match - SAFE for post-only
                msg!(
                    "Bid price {} < best ask {} - won't match. ACCEPTING",
                    order.price,
                    best_ask.price
                );
                return Ok(MatchOutcome::NoMatch(
                    "Order won't match - safe for post-only",
                ));
            }
        }
    }
}
pub fn match_ioc_orders(
    asks: &mut Slab,
    bids: &mut Slab,
    side: Side,
    order: &mut Order,
    market_pubkey: &Pubkey,
    event_queue: &mut EventQueue,
) -> Result<MatchOutcome> {
    match side {
        Side::Ask => {
            if bids.nodes.is_empty() {
                return Ok(MatchOutcome::NoMatch(
                    "opposite slab is empty, order can't be matched!",
                ));
            }
            let (
                execution_price,
                maker_order_id,
                maker_owner,
                available_qty,
                maker_qty,
                maker_filled,
            ) = {
                let best_bid = bids.nodes.first_mut().unwrap();
                if order.price > best_bid.price {
                    return Ok(MatchOutcome::NoMatch(
                        "ask price too high to cross best bid, no match",
                    ));
                }
                let available_qty = best_bid.quantity.min(order.quantity);
                let price = best_bid.price;
                order.quantity = order
                    .quantity
                    .checked_sub(available_qty)
                    .ok_or(OrderError::UnderFlow)?;
                best_bid.quantity = best_bid
                    .quantity
                    .checked_sub(available_qty)
                    .ok_or(SlabError::UnderFlow)?;
                (
                    price,
                    best_bid.order_id,
                    best_bid.owner,
                    available_qty,
                    best_bid.quantity,
                    best_bid.quantity == 0,
                )
            };

            if maker_filled {
                emit!(OrderFillEvent {
                    maker: maker_owner,
                    maker_order_id,
                    taker: order.owner,
                    taker_order_id: order.order_id,
                    side,
                    price: order.price,
                    base_lots_filled: available_qty,
                    base_lots_remaining: maker_qty,
                    timestamp: Clock::get()?.unix_timestamp,
                    market_pubkey: *market_pubkey,
                });
                bids.remove_order(&maker_order_id)?;
            } else {
                emit!(OrderPartialFillEvent {
                    maker: maker_owner,
                    maker_order_id,
                    taker: order.owner,
                    taker_order_id: order.order_id,
                    side,
                    price: order.price,
                    base_lots_filled: available_qty,
                    base_lots_remaining: maker_qty,
                    timestamp: Clock::get()?.unix_timestamp,
                    market_pubkey: *market_pubkey,
                });
            }
            let event = QueueEvent {
                event_type: if maker_filled { EventType::Fill } else { EventType::PartialFill },
                order_id: order.order_id,
                owner: order.owner,
                counterparty: maker_owner,
                side,
                price: execution_price,
                base_quantity: available_qty,
                client_order_id: order.client_order_id,
                timestamp: Clock::get()?.unix_timestamp,
                market_pubkey: *market_pubkey,
            };
            event_queue.insert_event(event)?;
            Ok(MatchOutcome::Matched(MatchResult {
                maker_qty,
                taker_qty: order.quantity,
                execution_price,
                counter_party:maker_owner
            }))
        }

        Side::Bid => {
            if asks.nodes.is_empty() {
                return Ok(MatchOutcome::NoMatch(
                    "opposite slab is empty, order can't be matched!",
                ));
            }
            let (
                execution_price,
                maker_order_id,
                maker_owner,
                available_qty,
                maker_qty,
                maker_filled,
            ) = {
                let best_ask = asks.nodes.first_mut().unwrap();
                if order.price < best_ask.price {
                    return Ok(MatchOutcome::NoMatch(
                        "bid price too low to cross best ask, no match",
                    ));
                }
                let available_qty = best_ask.quantity.min(order.quantity);
                let execution_price = best_ask.price;
                order.quantity = order
                    .quantity
                    .checked_sub(available_qty)
                    .ok_or(OrderError::UnderFlow)?;
                best_ask.quantity = best_ask
                    .quantity
                    .checked_sub(available_qty)
                    .ok_or(SlabError::UnderFlow)?;
                (
                    execution_price,
                    best_ask.order_id,
                    best_ask.owner,
                    available_qty,
                    best_ask.quantity,
                    best_ask.quantity == 0,
                )
            };

            match maker_filled {
                true => {
                    asks.remove_order(&maker_order_id)?;
                    emit!(OrderFillEvent {
                        maker: maker_owner,
                        maker_order_id,
                        taker: order.owner,
                        taker_order_id: order.order_id,
                        side,
                        price: order.price,
                        base_lots_filled: available_qty,
                        base_lots_remaining: 0,
                        timestamp: Clock::get()?.unix_timestamp,
                        market_pubkey: *market_pubkey,
                    });
                }
                false => {
                    emit!(OrderPartialFillEvent {
                        maker: maker_owner,
                        maker_order_id,
                        taker: order.owner,
                        taker_order_id: order.order_id,
                        side,
                        price: order.price,
                        base_lots_filled: available_qty,
                        base_lots_remaining: maker_qty,
                        timestamp: Clock::get()?.unix_timestamp,
                        market_pubkey: *market_pubkey,
                    });
                }
            }

            Ok(MatchOutcome::Matched(MatchResult {
                maker_qty,
                taker_qty: order.quantity,
                execution_price,
                counter_party:maker_owner
            }))
        }
    }
}
pub fn settle_amounts(
    accounts: &ConsumeEvents,
    event:&QueueEvent,
    vault_signer_bump:u8
)->Result<()>{
    let market =  accounts.market.key();
    let seeds = &[
        b"vault_signer",
        market.as_ref(),
        &[vault_signer_bump]
    ];
    let signer_seeds = &[&seeds[..]];
    let base_transfer_amount = event
                            .base_quantity
                            .checked_mul(accounts.market.base_lot_size)
                            .ok_or(MarketError::MathOverflow)?;
    
    let quote_transfer_amount = event
                            .base_quantity
                            .checked_mul(event.price)
                            .ok_or(MarketError::MathOverflow)?
                            .checked_mul(accounts.market.quote_lot_size)
                            .ok_or(MarketError::MathOverflow)?;
    match event.side {
        Side::Ask => {
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    accounts.token_program.to_account_info(), 
                    Transfer{
                        from:accounts.market_base_vault.to_account_info(),
                        to:accounts.maker_base_ata.to_account_info(),
                        authority:accounts.vault_signer.to_account_info()
                    }, 
                    signer_seeds
                ),
                base_transfer_amount
            )?;
            msg!("Settled: base {} → maker", base_transfer_amount);
            // transferring taker tokens
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    accounts.token_program.to_account_info(), 
                    Transfer { 
                        from: accounts.market_quote_vault.to_account_info(), 
                        to: accounts.taker_quote_ata.to_account_info(), 
                        authority: accounts.vault_signer.to_account_info()
                    }, 
                    signer_seeds
                ),
                quote_transfer_amount
            )?;
            msg!("Settled: quote {} → taker", quote_transfer_amount);
        }
        Side::Bid => {
            // settling taker's quote tokens
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    accounts.token_program.to_account_info(), 
                    Transfer { 
                        from: accounts.market_base_vault.to_account_info(), 
                        to: accounts.taker_base_ata.to_account_info(), 
                        authority: accounts.vault_signer.to_account_info()
                    }, 
                    signer_seeds
                ),
                base_transfer_amount
            )?;
            // settling maker's base tokens
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                accounts.token_program.to_account_info(), 
                    Transfer { 
                        from: accounts.market_quote_vault.to_account_info(), 
                        to: accounts.maker_quote_ata.to_account_info(), 
                        authority: accounts.vault_signer.to_account_info()
                    }, 
                    signer_seeds
                ),
                quote_transfer_amount
            )?;
        }
    }
    Ok(())
}

// Update order status in the open_orders account for the given order_id
pub fn update_order_status(
    open_orders: &mut OpenOrders,
    event: &QueueEvent,
    new_status: OrderStatus,
) -> Result<()> {
    if let Some(order) = open_orders
        .orders
        .iter_mut()
        .find(|o| o.order_id == event.order_id)
    {
        order.order_status = new_status;
        msg!(
            "Order {} status updated to {:?}",
            event.order_id,
            new_status
        );
    }
    // If order not found it may already be cleaned up — not a hard error
    Ok(())
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
