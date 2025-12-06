
<!-- ORDER TYPES IN DECECENTRALISED ORDER BOOK -->

<!-- Limit Order -->

Definition: Buy or sell a token at a specific price or better.

Behavior: If the price is available, the order may partially or fully match existing orders. Remaining quantity stays in the orderbook.

Real-world analogy: “I want to sell my SOL at exactly 102 USDC. If someone buys at 102 or higher, go ahead, otherwise wait.”



<!-- ImmediateOrCancel (IOC) order type -->

“Buy 10 SOL at 101 USDC or better right now; cancel what cannot be filled.”

===Step-by-step meaning==

🔹 Visual Example:

Market (asks = sellers):

Price	Quantity	Owner
100	    4 SOL	    Alice
101	    2 SOL	    Bob
102	    3 SOL	    Charlie

You place: Buy 10 SOL, IOC, max price 101 USDC

Match 100 → take 4 SOL from Alice

Match 101 → take 2 SOL from Bob

Remaining 4 SOL → cannot match any seller at 101 or lower → canceled

Result:

You bought 6 SOL immediately

You don’t have any pending order left in the orderbook

That’s exactly what “ImmediateOrCancel” means


<!-- PostOnly -->

Definition: Order only goes into the orderbook without immediately matching any existing orders.

Behavior: Useful for “maker” orders to avoid paying taker fees.

Real-world analogy: “I want to add liquidity, not take someone else’s order.”

Example:

User Dave places: Buy 5 SOL @ 101 USDC, PostOnly
BIDS slab (before):
Price | Qty | Owner
100   | 3   | Charlie
BIDS slab (after):
Price | Qty | Owner
101   | 5   | Dave   (added as a node, even if someone could have sold at 101)
100   | 3   | Charlie


