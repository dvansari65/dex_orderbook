// lib/orderIdGenerator.ts (or at top of your component file)
class ClientOrderIdGenerator {
    private counter: number = 0;
    private lastTimestamp: number = 0;
  
    generate(): number {
      let timestamp = Date.now();
      
      if (timestamp === this.lastTimestamp) {
        this.counter++;
      } else {
        this.counter = 0;
        this.lastTimestamp = timestamp;
      }
      
      const orderId = (timestamp * 1000) + this.counter;
      
      if (orderId > Number.MAX_SAFE_INTEGER) {
        throw new Error('Order ID exceeds safe integer range');
      }
      
      return orderId;
    }
  }
  
  // Create a singleton instance
  export const orderIdGenerator = new ClientOrderIdGenerator();