use std::ptr::null;
use std::{clone, u32};

use anchor_lang::prelude::*;

use crate::error::{EventError, EventQueueError, MarketError, OpenOrderError, OrderError, SlabError};
use crate::events::OrderFilledEvent;
use crate::state::{EventType::*, OrderType};

use crate::state::{Event, EventQueue, Node, OpenOrders, Order, Slab};
impl Slab {
    pub fn insert_order(
        &mut self,
        order_id: u64,
        quantity: u64,
        owner: Pubkey,
        price: u64,
    ) -> Result<()> {
        require!(self.nodes.len() < 32, OrderError::OrderbookFull);
        require!(self.free_list_len > 0,OrderError::NoSpace);
       
        let new_node = Node {
            price,
            quantity,
            owner,
            order_id,
            client_order_id: order_id as u64,
            timestamp: Clock::get()?.unix_timestamp,
            next: u32::MAX,
            prev: u32::MAX,
        };

        let insert_position = self.find_insert_position(price)?;
        msg!("insert position:{:?}",insert_position);
        if insert_position == self.nodes.len() {
            self.nodes.push(new_node);
            self.free_list_len -= 1;
        } else {
            self.nodes.push(new_node);
            self.update_links(insert_position)?;
            self.free_list_len -= 1;
        }
        self.update_links(insert_position)?;
        msg!("freel list len:{:?}",self.free_list_len);
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
    pub fn get_order_by_id (&mut self,order_id:u64)->Result<Option<&Node>> {
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
        self.orders_count = self.orders_count
                            .checked_add(1)
                            .ok_or(OpenOrderError::OrderOverFlow)?;
        Ok(order)
    }

    pub fn update_open_order_assets() -> Result<()> {
        Ok(())
    }

    pub fn remove_order(&mut self,order_id:u64)->Result<&mut OpenOrders>{
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
    asks: &mut Slab,
    bids: &mut Slab,
    event_queue:&mut EventQueue
) -> Result<()> {
    while !bids.nodes.is_empty() && !asks.nodes.is_empty() {
        let best_ask = asks.nodes.first().ok_or(MarketError::NoOrders)?;
        let best_bid = bids.nodes.first().ok_or(MarketError::NoOrders)?;
        let fill_qty = std::cmp::min(best_ask.quantity, best_bid.quantity);
        let fill_price = best_ask.price;

        if best_ask.price > best_bid.price {
            break;
        }
       
        let event = Event {
            order_id:best_ask.client_order_id,
            event_type:NewOrder,
            price:fill_price,
            quantity:fill_qty,
            maker:best_ask.owner,
            taker:best_bid.owner,
            timestamp:Clock::get()?.unix_timestamp as u64
        };

        event_queue.events.push(event.clone());
        emit!(event);

        asks.nodes[0].quantity -= fill_qty;
        bids.nodes[0].quantity -= fill_qty;
        
        if bids.nodes[0].quantity == 0 {
            bids.nodes.remove(0);
            bids.leaf_count -= 1;
        }
        if asks.nodes[0].quantity == 0 {
            asks.nodes.remove(0);
            asks.leaf_count -= 1;
        }
    }
    Ok(())
}
impl EventQueue {
    pub fn get_event_by_order_id (&mut self , order_id: &u64)->Result<Option<&Event>>{
        let event_position = self
                                        .events
                                        .iter()
                                        .position(|n| n.order_id == *order_id)
                                        .ok_or(EventError::OrderNotFound)?;
                                        
        let event = self.events.get(event_position);
        Ok(event)
    }
    pub fn insert_event(&mut self, event: &Event) -> Result<()> {
        const CAPACITY: usize = 32;

        // If queue full → overwrite oldest
        if self.count == CAPACITY as u32 {
            // Move tail forward (drop the oldest event)
            self.tail = (self.tail + 1) % CAPACITY as u32;
        } else {
            self.count += 1;
        }

        // Write event at header index
        if self.events.len() < CAPACITY {
            // Growing phase (first 32 inserts)
            self.events.push(event.clone());
        } else {
            // Fully allocated → overwrite
            self.events[self.header as usize] = event.clone();
        }

        // Move header forward
        self.header = (self.header + 1) % CAPACITY as u32;

        Ok(())
    }
}