use anchor_lang::prelude::*;
use orderbook::{state::{OrderStatus, Slab}, states::order_schema::enums::Side};
use std::str::FromStr;

fn dummy_pubkey() -> Pubkey {
    Pubkey::from_str("11111111111111111111111111111111").unwrap()
}

#[test]
fn test_insert_order() {
    let mut slab = Slab {
        head_index: 0,
        free_list_len: 1024,
        nodes: vec![],
        leaf_count: 0,
    };

    let owner = dummy_pubkey();
    let market = dummy_pubkey();
    let order_status= OrderStatus::PartialFill;
    // Insert first order
    slab.insert_order(1, 100, owner, 100,order_status,3450,&market,Side::Ask).unwrap();
    assert_eq!(slab.leaf_count, 1);
    assert_eq!(slab.nodes.len(), 1);
    assert_eq!(slab.nodes[0].price, 50);
    assert_eq!(slab.nodes[0].quantity, 100);
    assert_eq!(slab.free_list_len, 1023);
    msg!(" free list len from test {:?}", slab.free_list_len);

    // Insert second order with lower price (should go before)
    slab.insert_order(2, 200, owner, 101,order_status,4003,&market,Side::Ask).unwrap();
    assert_eq!(slab.leaf_count, 2);
    assert_eq!(slab.nodes[1].price, 30);
    assert_eq!(slab.nodes[0].price, 50);
    assert_eq!(slab.free_list_len, 1022);
    msg!(" free list len from test {:?}", slab.free_list_len);
    // Insert third order with higher price (should go last)
    slab.insert_order(3, 150, owner, 101,order_status,2027,&market,Side::Ask).unwrap();
    assert_eq!(slab.leaf_count, 3);
    assert_eq!(slab.nodes[2].price, 60);
    assert_eq!(slab.free_list_len, 1021);

    slab.insert_order(4, 110, owner, 103,order_status,2027,&market,Side::Ask).unwrap();
    assert_eq!(slab.leaf_count, 3);
    assert_eq!(slab.nodes[2].price, 60);
    assert_eq!(slab.free_list_len, 1021);
    assert_eq!(slab.nodes[3].price , 103);
    assert_eq!(slab.nodes[2].price , 101);
    assert_eq!(slab.nodes[2].order_id , 3);

    slab.update_links(1);
    assert_eq!(slab.nodes[1].prev, 0);
    assert_eq!(slab.nodes[1].next, 2);
    assert_eq!(slab.nodes[0].next, 1);

    {
        let removed_node = slab.remove_order(&2).unwrap();
        assert_eq!(removed_node.order_id, 2);
        // removed_node is dropped at the end of this block
    }
    slab.update_links_after_removing(1); // safe mutable borrow
    assert_eq!(slab.nodes[0].next, 1);
    assert_eq!(slab.nodes[1].prev, 0);

    let order_option = slab.get_order_by_id(3).unwrap();
    match order_option {
        Some(order) => {
            let order_id = order.order_id; // copy the value
            let price = order.price; // copy the value

            // Drop the reference here by ending the match early
            assert_eq!(order_id, slab.nodes[1].order_id);
            assert_eq!(price, slab.nodes[1].price);
        }
        None => panic!("Order not found!"),
    }
}
