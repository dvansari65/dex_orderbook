
use std::u32;

use anchor_lang::prelude::*;

use crate::state::{ Node, OpenOrders, Slab, Order};
use crate::error::OrderError;

impl Slab {
    pub fn insert_order (
        &mut self,
        order_id:u128,
        quantity:u64,
        owner:Pubkey,
        price:u64
    )->Result<()>{
        require!(
            self.nodes.len() < 1024,
            OrderError::OrderbookFull
        );

        let new_node = Node {
            price,
            quantity,
            owner,
            client_order_id:order_id as u64,
            timestamp:Clock::get()?.unix_timestamp,
            next:u32::MAX,
            prev:u32::MAX
        };

        let insert_position = self.find_insert_position(price)?;
        if insert_position == self.nodes.len(){
            self.nodes.push(new_node);
        }else {
            self.nodes.push(new_node);
            self.update_links(insert_position as u32)?;
        }
        self.leaf_count += 1;
        msg!(
            "Order inserted: {} @ price {} (total orders: {})",
            quantity,
            price,
            self.leaf_count
        );
        Ok(())
    }

    fn find_insert_position (&self,price:u64)->Result<usize>{
        for (i,node) in self.nodes.iter().enumerate() {
            if price < node.price {
                return Ok(i);
            }
        }
        Ok(self.nodes.len())
    }
    fn update_links (&mut self,index:u32)->Result<()>{
        if index > 0 {
            self.nodes[index as usize].prev = (index - 1) as u32;
            self.nodes[(index - 1 ) as usize].next = (index) as u32;
        }
        if index < (self.nodes.len() as u32) - 1 {
            self.nodes[index as usize].next = (index + 1) as u32;
            self.nodes[(index + 1) as usize].prev = index as u32;
        }
        Ok(())
    }
    fn remove_order ( &mut self , order_id:u64)->Result<Node>{
        let position = self.nodes
                        .iter()
                        .position(|n| n.client_order_id == order_id)
                        .ok_or(OrderError::OrderNotFound)?;
        let removed_node = self.nodes.remove(position);
        self.leaf_count -= 1;
        msg!("Order {} removed!",order_id);
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
    
}

impl OpenOrders {
    fn push_order(&mut self, order:Order)-> Result<()> {
        
        if self.orders.len() >= 1024 {
            msg!("Orders full!");
            return Err(OrderError::OrderFull.into())
        }
        self.orders.push(order);
        self.orders_count += 1;
        Ok(())
    }
}