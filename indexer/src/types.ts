export interface OrderbookEvent {
    type: 'OrderPlaced' | 'OrderFilled' | 'OrderCancelled';
    market: string;
    user: string;
    orderId: string;
    side: 'Bid' | 'Ask';
    price: number;
    quantity: number;
    timestamp: number;
  }
  
  export interface MarketState {
    market: string;
    bids: Order[];
    asks: Order[];
    lastUpdate: number;
  }
  
  export interface Order {
    price: number;
    quantity: number;
    owner: string;
    orderId: string;
  }