use std::u32;

use anchor_lang::prelude::*;

use crate::error::{EventError, MarketError, OpenOrderError, OrderError, SlabError,ErrorCode};
use crate::events::*;
use crate::state::{EventQueue, EventType, Market, OrderStatus, QueueEvent};

use crate::state::{Node, OpenOrders, Order, Slab};
use crate::states::order_schema::enums::Side;
impl Slab {
    pub fn insert_order(
        &mut self,
        order_id: u64,
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
        emit_order_placed(
            *market,
            owner,
            order_id,
            client_order_id,
            side,
            price,
            quantity,
        )?;
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

pub struct MatchResult {
    pub filled_quantity: u64,
    pub remaining_quantity: u64,
    pub order_status: OrderStatus,
    pub total_quote_qty: u64,
}

pub fn match_orders(
    side: Side,
    order: &mut Order,
    asks: &mut Slab,
    bids: &mut Slab,
    event_queue: &mut EventQueue,
) -> Result<MatchResult> {
    // 1. Identify the correct side to match against
    let opposite_slab = match side {
        Side::Ask => bids, // Sellers match with existing Bids
        Side::Bid => asks, // Buyers match with existing Asks
    };

    let initial_quantity = order.quantity;
    let mut total_quote_qty = 0u64;

    // 2. Matching Loop
    while !opposite_slab.nodes.is_empty() && order.quantity > 0 {
        // We scope the borrow of 'best_opposite' so we can drop it before calling 'remove_order'
        let (fill_qty, execution_price, maker_id, maker_owner, maker_filled) = {
            let best_opposite = opposite_slab.nodes.first_mut().unwrap();

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

            // Update quantities in place
            best_opposite.quantity = best_opposite.quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;
            
            order.quantity = order.quantity
                .checked_sub(fill_qty)
                .ok_or(OrderError::UnderFlow)?;

            (
                fill_qty, 
                execution_price, 
                best_opposite.order_id.clone(), 
                best_opposite.owner, 
                best_opposite.quantity == 0
            )
        };

        // 4. Calculate Quote Volume
        let quote_qty = fill_qty
            .checked_mul(execution_price)
            .ok_or(OrderError::OverFlow)?;

        total_quote_qty = total_quote_qty
            .checked_add(quote_qty)
            .ok_or(OrderError::OverFlow)?;

        // 5. Emit Event & Update Status
        // We emit ONE event per match. Your indexer uses this to update both sides.
        let event_type = if order.quantity == 0 { EventType::Fill } else { EventType::PartialFill };
        
        if event_type == EventType::Fill {
            emit_order_fill(
                order.owner,
                order.client_order_id,
                maker_owner,
                maker_id.clone(),
                side,
                execution_price,
                fill_qty,
                order.quantity,
            )?;
        } else {
            emit_partial_fill_order(
                order.owner,
                order.client_order_id,
                maker_owner,
                maker_id.clone(),
                side,
                execution_price,
                fill_qty,
                order.quantity,
            )?;
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
        };
        event_queue.insert_event(event)?;

        // 6. Cleanup: Remove fully filled Maker from the book
        if maker_filled {
            opposite_slab.remove_order(&maker_id)?;
            msg!("Opposite Order Fully filled and removed from slab");
        }
    }

    // 7. Finalize Taker Status
    let filled_quantity = initial_quantity - order.quantity;
    order.order_status = if order.quantity == 0 {
        OrderStatus::Fill
    } else if filled_quantity > 0 {
        OrderStatus::PartialFill
    } else {
        OrderStatus::Open
    };

    Ok(MatchResult {
        filled_quantity,
        remaining_quantity: order.quantity,
        order_status: order.order_status,
        total_quote_qty,
    })
}

pub fn match_post_only_orders(asks: &Slab, bids: &Slab, side: Side, order: &Order) -> Result<()> {
   
    match side {
        Side::Ask => {
            if bids.nodes.is_empty() {
                return Ok(())
            }
            let best_bid = bids.nodes.first().ok_or(OrderError::InvalidNode)?;
            if order.price <= best_bid.price {
                msg!("Best bid is greater than selling price, so order can match, returning...");
                return Err(OrderError::WouldMatchImmediately.into());
            }

        },
        Side::Bid => if asks.nodes.is_empty(){
            if bids.nodes.is_empty(){
                return Ok(())
            }
            let best_ask = asks.nodes.first().ok_or(OrderError::InvalidNode)?;
            if order.price >= best_ask.price {
                msg!("Bidding price is greater than best ask price, so order can match,returning...");
                return Err(OrderError::WouldMatchImmediately)?;
            }
        }
    }
    Ok(())
}

pub fn match_ioc_orders(
    asks: &mut Slab,
    bids: &mut Slab,
    side: Side,
    order: &mut Order,
) -> Result<()> {
   match side {
       Side::Ask =>{
            if asks.nodes.is_empty(){
                return Ok(())
            }
            let maker_order_id;
            let maker_owner;
            let is_filled_user;
            let is_filled_existing_user;
            let available_qty;
            {
                let best_bid = bids.nodes.first_mut().unwrap();
                if order.price > best_bid.price {
                    return Ok(());
                }
                available_qty = best_bid.quantity.min(order.quantity);

                order.quantity = order
                                .quantity
                                .checked_sub(available_qty)
                                .ok_or(OrderError::UnderFlow)?;
                best_bid.quantity = best_bid
                                .quantity
                                .checked_sub(available_qty)
                                .ok_or(SlabError::UnderFlow)?;
                is_filled_existing_user = best_bid.quantity == 0;
                
                maker_owner = best_bid.owner;
                maker_order_id = best_bid.order_id;
            }
            is_filled_user = order.quantity == 0;
            if is_filled_user {
                msg!("order removed of user :{:?} and order id:{:?}", order.owner, order.order_id);
                asks.remove_order(&order.order_id)?;
            }
            if is_filled_existing_user {
                msg!("order removed of user :{:?} and order id:{:?}", maker_owner, maker_order_id);
                asks.remove_order(&maker_order_id)?;
            }
            emit_order_fill(
                maker_owner,
                maker_order_id,
                order.owner,
                order.order_id,
                side,
                order.price,
                available_qty,
                0,
            )?;
       },
       Side::Bid => {
            if asks.nodes.is_empty(){
                return Ok(());
            }
            
            let maker_order_id;
            let maker_owner;
            let is_filled_user;
            let is_filled_existing_user;
            let available_qty;
            let remaining_qty;
            {
                let best_ask = asks.nodes.first_mut().unwrap();
                if order.price < best_ask.price {
                    return Ok(())
                }
                available_qty = best_ask.quantity.min(order.quantity);
                order.quantity = order      
                                    .quantity
                                    .checked_sub(available_qty)
                                    .ok_or(OrderError::UnderFlow)?;
                best_ask.quantity = best_ask
                                    .quantity
                                    .checked_sub(available_qty)
                                    .ok_or(SlabError::UnderFlow)?;
                maker_order_id = best_ask.order_id;
                maker_owner = best_ask.owner;
                is_filled_existing_user = best_ask.quantity == 0;
                remaining_qty = best_ask.quantity;
            }
            is_filled_user = order.quantity == 0;
            if !is_filled_user {
                msg!("order removed of user :{:?} and order id:{:?}", order.owner, order.order_id);
                emit_partial_fill_order(
                    maker_owner,
                    maker_order_id,
                    order.owner,
                    order.order_id,
                    side,
                    order.price,
                    available_qty,
                    order.quantity,
                )?;
                msg!("order partially filled! order ID :{:?}",order.order_id);
            }
            if !is_filled_existing_user {
                msg!("order removed of user :{:?} and order id:{:?}", maker_owner, maker_order_id);
                emit_partial_fill_order(
                    maker_owner,
                    maker_order_id,
                    order.owner,
                    order.order_id,
                    side,
                    order.price,
                    available_qty,
                    remaining_qty,
                )?;
                msg!("order partially filled! order ID :{:?}",order.order_id);
            }

            bids.remove_order(&order.order_id)?;
            bids.remove_order(&maker_order_id)?;
            emit_order_fill(
                maker_owner,
                    maker_order_id,
                    order.owner,
                    order.order_id,
                    side,
                    order.price,
                    available_qty,
                    remaining_qty,
                )?;
           msg!("Order partially filled! Order ID:{:?} and maker order ID:{:?}",order.order_id,maker_order_id);
       }
   }
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
        println!(
            ">>>>event inserted!:{:?}  and order id : {:?}",
            self, self.events[0]
        );
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
