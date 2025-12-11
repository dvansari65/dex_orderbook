import { EventListener } from "./listener";
import { InMemoryStorage } from "./storage";
import { OrderbookEvent, EventType, Market } from "./types";

const RPC_URL =  "http://127.0.0.1:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "2BRNRPFwJWjgRGV3xeeudGsi9mPBQHxLWFB6r3xpgxku";
const MARKET_PUBKEY = "CGXdRE1s7NdB8GM75zY3EaxUSg51cNkisAKrSzqZvAhN";

async function main() {
  console.log("Starting indexer...");
  console.log("RPC:", RPC_URL);
  console.log("Program:", PROGRAM_ID);
  console.log("Market:", MARKET_PUBKEY);

  const listener = new EventListener(RPC_URL, PROGRAM_ID);
  const storage = new InMemoryStorage();

  let marketData:Market | null = null;
  // Start listening
  await listener.start((event) => {
    console.log(`Event: ${event.type}`, event.data);

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
      console.log("Event stored:", orderbookEvent.eventType);
    } catch (error) {
      console.error(" Error storing event:", error);
    }
  });
  // Poll market state
  setInterval(async () => {
    try {
       marketData = await listener.fetchMarketState(MARKET_PUBKEY);

      if (marketData) {
       
        console.log("📊 Market state:", {
        baseMint: marketData.baseMint.toString(),
        quoteMint: marketData.quoteMint.toString(),
        baseVault: marketData.baseVault.toString(),
        quoteVault: marketData.quoteVault.toString(),
        bids: marketData.bids.toString(),
        asks: marketData.asks.toString(),
        eventQueue: marketData.eventQueue.toString(),
        baseLotSize: marketData.baseLotSize.toString(),  // BN → string
        quoteLotSize: marketData.quoteLotSize.toString(),
        makerFeesBps: marketData.makerFeesBps.toString(),
        takerFeesBps: marketData.takerFeesBps.toString(),
        admin: marketData.admin.toString(),
        vaultSignerNonce: marketData.vaultSignerNonce,
        marketStatus: marketData.marketStatus,
        minOrderSize: marketData.minOrderSize.toString(),
        maxOrdersPerUser: marketData.maxOrdersPerUser,
        padding: Array.from(marketData.padding),
        status: marketData.marketStatus,
        });
      }
      if (marketData?.asks) {
        const asks = await listener.fetchAskSlabState(marketData.asks);
        console.log("asks data:",asks?.nodes[0].clientOrderId.toString())
      }
    } catch (error) {
      console.error("❌ Error fetching market:", error);
    }
  }, 5000);
  
  console.log("✅ Indexer running!");
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});