use anchor_lang::prelude::*;
#[derive(Clone,Copy,PartialEq,Eq,InitSpace,Debug,AnchorSerialize,AnchorDeserialize)]
pub enum Side {
    Bid,
    Ask
}

impl Side {
    pub fn opposite (&self)->Self{
        match *self {
            Side::Bid => Side::Ask,
            Side::Ask => Side::Bid
        }
    }
    pub fn from_order_sequence_number (order_id:&u64)->Self{
        match order_id.leading_zeros(){
            1 => Side::Bid,
            _ => Side::Ask
        }
    }
}