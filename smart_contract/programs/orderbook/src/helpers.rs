use std::u32;

use anchor_lang::prelude::*;

use crate::error::{
    EventError, MarketError, OrderError, SlabError,
    TraderEntryError,
};
use crate::state::{ FillRecord, Market, OrderStatus, OrderType, TraderEntry};

use crate::state::{Node, Slab};
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

// Checks whether a PostOnly order would match immediately.
// Returns true  → order WOULD cross → reject it.
// Returns false → order is safe → insert into book.
// Pure read — does not mutate anything.
pub fn would_match_post_only(side: Side, order_price: u64, asks: &Slab, bids: &Slab) -> bool {
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
) -> (
    &'info mut Account<'info, Slab>,
    &'info mut Account<'info, Slab>,
) {
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
    quantity: u64,
    price: u64,
    opposite_slab: &mut Slab,
) -> Result<Vec<FillRecord>> {
    msg!("matching started");

    let mut fills: Vec<FillRecord> = Vec::new();

    while !opposite_slab.nodes.is_empty() && quantity > 0 {
        let fill = {
            let best = opposite_slab
                .nodes
                .first_mut()
                .ok_or(OrderError::InvalidNode)?;

            let can_match = match side {
                Side::Ask => price <= best.price,
                Side::Bid => price >= best.price,
            };
            if !can_match {
                break;
            }

            let fill_qty = best.quantity.min(quantity);
            let execution_price = best.price;

            best.quantity = best
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
    price: u64,
    quantity: u64,
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
        Side::Ask => price <= best.price,
        Side::Bid => price >= best.price,
    };

    if !can_match {
        return Ok(None);
    }

    let fill_qty = best.quantity.min(quantity);
    let execution_price = best.price;

    best.quantity = best
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

pub fn update_trader_entry(
    is_maker: bool,
    side: Side,
    fill_record: &FillRecord,
    trader_entry:Option<&mut TraderEntry>,
    base_lot_size: u64,
    quote_lot_size: u64,
) -> Result<()> {
    let base_amount_to_update = fill_record // base amount to update of taker
        .fill_qty
        .checked_mul(base_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    let quote_amount_to_update = fill_record
        .execution_price
        .checked_mul(fill_record.fill_qty)
        .ok_or(MarketError::MathOverflow)?
        .checked_mul(quote_lot_size)
        .ok_or(MarketError::MathOverflow)?;

    match trader_entry {

        Some(entry) => match side {
            Side::Ask => {
                // this side is in the perspective of the taker 
                //  so when side is ask for taker then side will be bid for maker
                // that's why we are checking is_maker, if it is maker then it will update entries opposite 
                // taker's side
                if is_maker {
                    entry.trader_state.quote_lots_locked = entry
                        .trader_state
                        .quote_lots_locked
                        .checked_sub(quote_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.base_lots_free = entry
                        .trader_state
                        .base_lots_free
                        .checked_add(base_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?
                } else {
                    entry.trader_state.quote_lots_free = entry
                        .trader_state
                        .quote_lots_free
                        .checked_add(quote_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.base_lots_locked = entry
                        .trader_state
                        .base_lots_locked
                        .checked_sub(base_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?
                }
            }
            Side::Bid => {
                if is_maker {
                    entry.trader_state.quote_lots_free = entry
                        .trader_state
                        .quote_lots_free
                        .checked_add(quote_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.base_lots_locked = entry
                        .trader_state
                        .base_lots_locked
                        .checked_sub(base_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?
                } else {
                    entry.trader_state.quote_lots_locked = entry
                        .trader_state
                        .quote_lots_locked
                        .checked_sub(quote_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?;

                    entry.trader_state.base_lots_free = entry
                        .trader_state
                        .base_lots_free
                        .checked_add(base_amount_to_update)
                        .ok_or(MarketError::MathOverflow)?;
                }
            }
        },
        None => {
            return err!(TraderEntryError::EntryNotFound);
        }
    }
    Ok(())
}
