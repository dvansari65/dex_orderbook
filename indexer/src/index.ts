import { EventListener } from "./listener";
import { InMemoryStorage } from "./storage";
const RPC_URL = process.env.RPC_URL || "http://localhost:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H";
const MARKET_PUBKEY = process.env.MARKET_PUBKEY || "YOUR_MARKET_PUBKEY";
console.log("started.....");

async function main() {
    console.log("Starting indexer....");
    const listener = new EventListener(RPC_URL, PROGRAM_ID);
    const storage = new InMemoryStorage();

    listener.start((event) => {
        console.log("Event recived:", event);
        storage.storeEvent({
            type: event.type,
            market: MARKET_PUBKEY,
            user: event.data.maker?.toString() || "unknown",
            orderId: event.data.orderId?.toString() || "unknown",
            side: "Bid",
            price: event.data.price || 0,
            quantity: event.data.quantity || 0,
            timestamp: Date.now(),
        });
    });
    setInterval(async () => {
        const marketData = await listener.fetchMarketState(MARKET_PUBKEY);
        if (marketData) {
            console.log("📊 Market state updated");
        }
    }, 5000);
}
