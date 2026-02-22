export interface Order {
    orderId: string
    side: 'bid' | 'ask'
    price: number
    quantity: number
    filled: number
    status: 'open' | 'partial' | 'filled' | 'cancelled'
    placedAt: string
  }
  