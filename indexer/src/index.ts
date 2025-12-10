import { EventListener } from "./listener";
import { InMemoryStorage } from "./storage";
import { OrderbookEvent, EventType } from "./types";

const RPC_URL = process.env.RPC_URL || "http://localhost:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "CGar3YimvFpENuuSnFGqZXMbDc7D76mqu7YTvMftBnsN";
const MARKET_PUBKEY = process.env.MARKET_PUBKEY || "2Qo5oTvW32vAv6z57cNK3n5hRvsvm6LF6hzVHfTLBrqZ";

async function main() {
  console.log("🚀 Starting indexer...");
  console.log("📡 RPC:", RPC_URL);
  console.log("📡 Program:", PROGRAM_ID);
  console.log("📡 Market:", MARKET_PUBKEY);

  const listener = new EventListener(RPC_URL, PROGRAM_ID);
  const storage = new InMemoryStorage();

  // Start listening
  await listener.start((event) => {
    console.log(`📨 Event: ${event.type}`, event.data);

    try {
      const orderbookEvent: OrderbookEvent = {
        orderId: event.data.orderId?.toString() || "0",
        eventType: event.data.eventType as EventType,
        price: Number(event.data.price) || 0,
        quantity: Number(event.data.quantity) || 0,
        maker: event.data.maker?.toString() || "",
        taker: event.data.taker?.toString() || "",
        timestamp: Number(event.data.timestamp) || Date.now(),
      };

      storage.storeEvent(orderbookEvent);
      console.log("✅ Event stored:", orderbookEvent.eventType);
    } catch (error) {
      console.error("❌ Error storing event:", error);
    }
  });

  // Poll market state
  setInterval(async () => {
    try {
      const marketData = await listener.fetchMarketState(MARKET_PUBKEY);
      if (marketData) {
        console.log("📊 Market state:", {
          baseLotSize: marketData.baseLotSize?.toString(),
          quoteLotSize: marketData.quoteLotSize?.toString(),
          status: marketData.marketStatus,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching market:", error);
    }
  }, 10000);

  console.log("✅ Indexer running!");
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});