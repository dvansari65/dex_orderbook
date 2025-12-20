use std::ptr::null;
use std::{clone, u32};

use anchor_lang::{Event, prelude::*};

use crate::error::{
    EventError, EventQueueError, MarketError, OpenOrderError, OrderError, SlabError,
};
use crate::events::*;
use crate::state::{ EventQueue, EventType, Market, OrderStatus, OrderType, QueueEvent};

use crate::state::{ Node, OpenOrders, Order, Slab};
use crate::states::order_schema::enums::Side;
impl Slab {
    pub fn insert_order(
        &mut self,
        order_id: u64,
        quantity: u64,
        owner: Pubkey,
        price: u64,
        order_status: OrderStatus,
    ) -> Result<()> {
        require!(self.nodes.len() < 32, OrderError::OrderbookFull);
        require!(self.free_list_len > 0, OrderError::NoSpace);

        let new_node = Node {
            price,
            quantity,
            owner,
            order_id,
            client_order_id: order_id as u64,
            timestamp: Clock::get()?.unix_timestamp,
            next: u32::MAX,
            prev: u32::MAX,
            order_status,
        };

        let insert_position = self.find_insert_position(price)?;
        msg!("insert position:{:?}", insert_position);
        if insert_position == self.nodes.len() {
            self.nodes.push(new_node);
            self.free_list_len -= 1;
        } else {
            self.nodes.push(new_node);
            self.update_links(insert_position)?;
            self.free_list_len -= 1;
        }
        self.update_links(insert_position)?;
        msg!("freel list len:{:?}", self.free_list_len);
        self.leaf_count += 1;
        msg!(
            "Order inserted: {} @ price {} (total orders: {})",
            quantity,
            price,
            self.leaf_count
        );
        Ok(())
    }

    pub fn find_insert_position(&self, price: u64) -> Result<usize> {
        for (i, node) in self.nodes.iter().enumerate() {
            if price < node.price {
                return Ok(i);
            }
        }
        Ok(self.nodes.len())
    }
    pub fn update_links(&mut self, index: usize) -> Result<()> {
        if index > 0 {
            self.nodes[index as usize].prev = (index - 1) as u32;
            self.nodes[(index - 1) as usize].next = (index) as u32;
        }
        if index < (self.nodes.len()) - 1 {
            self.nodes[index as usize].next = (index + 1) as u32;
            self.nodes[(index + 1) as usize].prev = index as u32;
        }
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
            .position(|n| n.client_order_id == *order_id as u64)
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
    pub fn push_order(&mut self, order: Order) -> Result<(Order)> {
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
    event_queue  :&mut EventQueue
) -> Result<MatchResult> {
    let (opposite_slab, same_side_slab) = match side {
        Side::Ask => (bids, asks),
        Side::Bid => (asks, bids),
    };

    let initial_quantity = order.quantity;
    let mut total_quote_qty = 0u64;

    while !opposite_slab.nodes.is_empty() && order.quantity > 0 {
        let best_opposite = opposite_slab.nodes.first_mut().unwrap();
        
        if (side == Side::Ask && order.price > best_opposite.price)
            || (side == Side::Bid && order.price < best_opposite.price)
        {
            break;
        }

        let fill_qty = best_opposite.quantity.min(order.quantity);
        let quote_qty = fill_qty.checked_mul(best_opposite.price)
            .ok_or(OrderError::OverFlow)?;
        
        total_quote_qty = total_quote_qty.checked_add(quote_qty)
            .ok_or(OrderError::OverFlow)?;

        order.quantity = order
            .quantity
            .checked_sub(fill_qty)
            .ok_or(OrderError::UnderFlow)?;
            
        best_opposite.quantity = best_opposite
            .quantity
            .checked_sub(fill_qty)
            .ok_or(OrderError::UnderFlow)?;

        let slab_order_node = same_side_slab
            .get_order_by_id(order.order_id)
            .unwrap()
            .ok_or(OrderError::OrderNotFound)?;

        let best_opposite_id = best_opposite.order_id;
        let best_opposite_owner = best_opposite.owner;
        let is_filled = best_opposite.quantity == 0;

        if is_filled {
            best_opposite.order_status = OrderStatus::Fill;
            drop(best_opposite);
            
            opposite_slab.remove_order(&best_opposite_id)?;
            
            emit_order_fill(
                slab_order_node.owner,
                order.client_order_id,
                best_opposite_owner,
                best_opposite_id,
                side,
                order.price,
                fill_qty,
                order.quantity,
            );
            let event = QueueEvent {
                event_type:EventType::Fill,
                order_id:order.order_id,
                owner:slab_order_node.owner,
                counterparty:best_opposite_owner,
                side:side,
                price:order.price,
                base_quantity:fill_qty,
                client_order_id:order.client_order_id,
                timestamp:Clock::get()?.unix_timestamp
            };
            event_queue.insert_event(event);
        } else {
            best_opposite.order_status = OrderStatus::PartialFill;
            
            emit_partial_fill_order(
                slab_order_node.owner,
                order.client_order_id,
                best_opposite_owner,
                best_opposite_id,
                side,
                order.price,
                fill_qty,
                order.quantity,
            );
            let event = QueueEvent {
                event_type:EventType::PartialFill,
                order_id:order.order_id,
                owner:slab_order_node.owner,
                counterparty:best_opposite_owner,
                side:side,
                price:order.price,
                base_quantity:fill_qty,
                client_order_id:order.client_order_id,
                timestamp:Clock::get()?.unix_timestamp
            };
            event_queue.insert_event(event);
        }

        if order.quantity == 0 {
            order.order_status = OrderStatus::Fill;
            break;
        }
    }

    let filled_quantity = initial_quantity - order.quantity;
    
    Ok(MatchResult {
        filled_quantity,
        remaining_quantity: order.quantity,
        order_status: order.order_status,
        total_quote_qty,
    })
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
