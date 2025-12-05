use std::str::FromStr;
use anchor_lang::prelude::*;
use orderbook::state::Slab;


fn dummy_pubkey() -> Pubkey {
    Pubkey::from_str("11111111111111111111111111111111").unwrap()
}

#[test]
fn test_insert_order() {
    let mut slab = Slab {
        head_index:0,
        free_list_len:1024,
        nodes: vec![],
        leaf_count: 0,
    };

    let owner = dummy_pubkey();

    // Insert first order
    slab.insert_order(1, 100, owner, 50).unwrap();
    assert_eq!(slab.leaf_count, 1);
    assert_eq!(slab.nodes.len(), 1);
    assert_eq!(slab.nodes[0].price, 50);
    assert_eq!(slab.nodes[0].quantity, 100);
    assert_eq!(slab.free_list_len,1023);
    msg!(" free list len from test {:?}",slab.free_list_len);
    
    // Insert second order with lower price (should go before)
    slab.insert_order(2, 200, owner, 30).unwrap();
    assert_eq!(slab.leaf_count, 2);
    assert_eq!(slab.nodes[0].price, 30);
    assert_eq!(slab.nodes[1].price, 50);
    assert_eq!(slab.free_list_len,1022);
    // Insert third order with higher price (should go last)
    slab.insert_order(3, 150, owner, 60).unwrap();
    assert_eq!(slab.leaf_count, 3);
    assert_eq!(slab.nodes[2].price, 60);
    assert_eq!(slab.free_list_len,1021);
}