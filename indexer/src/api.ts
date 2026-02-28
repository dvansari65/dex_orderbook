import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import { EventListener } from "./listener";
import { Conversion } from "./utils/conversion";
import { Market } from "../types/market";
import { snapshotOfCandle, handleFillEvent } from '../service/candle';
import { getOrderHistory } from "../service/orderHistory";
import { createOrder } from "../service/orderHistory";
import parseOrderFillEvent from "../helper/parseOrderFillEventData";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "";
const MARKET_PUBKEY = process.env.MARKET_PUBKEY || "";
console.log("market key:", MARKET_PUBKEY);
const PORT = process.env.PORT || 3001;
console.log("port:", PORT);

if (!PROGRAM_ID || !MARKET_PUBKEY) {
  console.error("❌ PROGRAM_ID and MARKET_PUBKEY must be set in .env");
  process.exit(1);
}

export const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["POST", "GET"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Global listener instance
const listener = new EventListener(RPC_URL, PROGRAM_ID);
let eventCleanup: (() => Promise<void>) | null = null;

// Track active connections
const activeConnections = new Map<string, Socket>();

/**
 * Fetch and format orderbook data
 */
const fetchOrderBook = async (
  marketState: Market | null,
  conversion: Conversion
): Promise<{
  asks: Array<{ price: number; quantity: number; orderId: number }>;
  bids: Array<{ price: number; quantity: number; orderId: number }>;
}> => {
  if (!marketState || !marketState.asks || !marketState.bids) {
    console.error("❌ Invalid market state - missing asks or bids");
    return { asks: [], bids: [] };
  }

  const askSlabKey = marketState.asks.toString();
  const bidSlabKey = marketState.bids.toString();

  const [askSlabData, bidSlabData] = await Promise.all([
    listener.fetchAskSlabState(askSlabKey),
    listener.fetchBidSlabState(bidSlabKey),
  ]);

  const convertNodes = (nodes: any[]) =>
    nodes
      .filter((node) => node && node.price)
      .map((node) => conversion.convertNode(node));

  return {
    asks: askSlabData?.nodes ? convertNodes(askSlabData.nodes) : [],
    bids: bidSlabData?.nodes ? convertNodes(bidSlabData.nodes) : [],
  };
};

/**
 * Format market metadata for client
 */
const formatMarketMetadata = (marketState: Market) => ({
  marketPubkey: MARKET_PUBKEY,
  baseLotSize: marketState.baseLotSize,
  quoteLotSize: marketState.quoteLotSize,
  baseMint: marketState.baseMint?.toString(),
  quoteMint: marketState.quoteMint?.toString(),
});

/**
 * Handle new socket connections
 */
io.on("connection", async (socket: Socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  activeConnections.set(socket.id, socket);
  
  try {
    const marketState = await listener.fetchMarketState(MARKET_PUBKEY);
    if (!marketState) {
      socket.emit("error", { message: "Market not found", timestamp: Date.now() });
      socket.disconnect();
      return;
    }

    const conversion = new Conversion(marketState);

    // ── Fetch everything in parallel ──────────────────────────────────────
    const [{ asks, bids }, candles] = await Promise.all([
      fetchOrderBook(marketState, conversion),
      snapshotOfCandle("1d", MARKET_PUBKEY),
    ]);

    console.log("asks:", asks);
    console.log("bids:", bids);

    // ── One single emit with all data ─────────────────────────────────────
    socket.emit("snapshot", {
      market:    formatMarketMetadata(marketState),
      orderbook: { asks, bids },
      candles:   { candles: candles.candles, volumeData: candles.volumeData }
    });

    console.log(`📸 Snapshot sent to ${socket.id}: ${asks.length} asks, ${bids.length} bids`);

    // ── Order history — fetched when wallet connects ───────────────────────
    socket.on("user-pubkey", async (pubkey: string) => {
      const orderHistory = await getOrderHistory(pubkey, MARKET_PUBKEY);
      socket.emit("order-history", orderHistory);
    });

    // ── Resolution change ─────────────────────────────────────────────────
    socket.on("resolution", async ({ resolution }: { resolution: string }) => {
      try {
        const candles = await snapshotOfCandle(resolution, MARKET_PUBKEY);
        socket.emit(`resolution:${resolution}`, {
          candles: { candles: candles.candles, volumeData: candles.volumeData },
        });
      } catch (error) {
        console.error("Error handling resolution change:", error);
      }
    });

    // ── Event listener ────────────────────────────────────────────────────
    if (!eventCleanup) {
      eventCleanup = await listener.start(async (events) => {
        const payloads = [];
    
        for (const event of events) {
          if (!event || !event.data) {
            console.warn("⚠️ Invalid event");
            continue;
          }
    
          console.log("events:", event);
    
          try {
            if (event.name === "orderPlacedEvent") {
              const conversion = new Conversion(marketState);
              const converted = conversion.convertEvent(event.data);
              await createOrder(event.data);
              payloads.push({
                type: "orderPlacedEvent",
                data: {
                  p:  converted.price,
                  q:  converted.quantity,
                  ts: converted.timestamp,
                  s:  converted.side,
                  id: converted?.orderId,
                }
              });
            }
    
            if (event.name === "orderFillEvent" || event.name === "orderPartialFillEvent") {
              console.log("fill event trigger....");
              const orderFilledEventData = parseOrderFillEvent(event);
              if (!orderFilledEventData) {
                console.error("❌ parseOrderFillEvent returned falsy");
                continue;
              }
              payloads.push({ type: "orderFillEvent", data: orderFilledEventData });
    
              // candle logic untouched
              const fillResult = await handleFillEvent(event.data, event.signature);
              if (!fillResult) {
                io.emit("error", { message: "Failed to create candle for order fill event!" });
                continue;
              }
              io.emit("candle:filled", {
                candle:    fillResult.candle,
                volume:    fillResult.volume,
                timestamp: fillResult.timestamp,
              });
            }
    
            if (event.name === "OrderCancelledEvent") {
              const conversion = new Conversion(marketState);
              const converted = conversion.convertEvent(event.data);
              payloads.push({
                type: "OrderCancelledEvent",
                data: {
                  p:  converted.price,
                  q:  converted.quantity,
                  ts: converted.timestamp,
                  s:  converted.side,
                  id: converted?.orderId,
                }
              });
            }
          } catch (error: any) {
            console.error("❌ Error processing event:", error);
            io.emit("error", { message: error.message });
          }
        }
    
        // ONE emit for the entire transaction
        if (payloads.length > 0) {
          io.emit("tx:events", payloads);
        }
      });
    
      console.log("🎧 Event listener started");
    }
    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      activeConnections.delete(socket.id);
    });

  } catch (error: any) {
    console.error("❌ Connection error:", error);
    socket.emit("error", { message: error.message || "Internal server error", timestamp: Date.now() });
    socket.disconnect();
  }
});

/**
 * Stop event listener
 */
const stopEventListener = async () => {
  if (eventCleanup) {
    console.log("🛑 Stopping event listener...");
    await eventCleanup();
    eventCleanup = null;
  }
};

/**
 * Health check endpoint
 */
app.get("/health", async (req, res) => {
  const health = await listener.getConnectionHealth();
  res.json({
    status:      health.connected ? "ok" : "unhealthy",
    market:      MARKET_PUBKEY,
    slot:        health.slot,
    connections: activeConnections.size,
    timestamp:   Date.now(),
  });
});

/**
 * Get current orderbook snapshot
 */
app.get("/orderbook", async (req, res) => {
  try {
    const marketState = await listener.fetchMarketState(MARKET_PUBKEY);

    if (!marketState) {
      return res.status(404).json({ error: "Market not found" });
    }

    const conversion = new Conversion(marketState);
    const { asks, bids } = await fetchOrderBook(marketState, conversion);

    res.json({
      market:    formatMarketMetadata(marketState),
      orderbook: { asks, bids },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Graceful shutdown
 */
const gracefulShutdown = async () => {
  console.log("\n🛑 Shutting down gracefully...");

  io.close();
  await stopEventListener();
  await listener.cleanup();

  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("⚠️ Forced shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});

/**
 * Start server
 */
server.listen(PORT, () => {
  console.log(`\n✅ Indexer running!`);
  console.log(`📡 HTTP API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🎯 Market: ${MARKET_PUBKEY}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});