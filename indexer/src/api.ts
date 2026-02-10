import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import { EventListener } from "./listener";
import { Conversion } from "./utils/conversion";
import { Market } from "../types/market";
import { handleFillEvent, snapshotOfCandle } from '../service/candle';
import { BN } from "@coral-xyz/anchor";
import { OrderEvent } from "../service/events";



dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "";
const MARKET_PUBKEY = process.env.MARKET_PUBKEY || "";
const PORT = process.env.PORT || 3001;
console.log("port:", PORT)
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
  asks: Array<{ price: number; quantity: number,orderId:number }>;
  bids: Array<{ price: number; quantity: number,orderId:number }>;
}> => {
  // Validate market state before proceeding
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
  console.log("side:",)
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
    // Fetch market state
    const marketState = await listener.fetchMarketState(MARKET_PUBKEY);
    console.log("makret state:", marketState)
    if (!marketState) {
      socket.emit("error", {
        message: "Market not found",
        timestamp: Date.now(),
      });
      socket.disconnect();
      return;
    }

    const conversion = new Conversion(marketState);

    // Send initial snapshot
    const { asks, bids } = await fetchOrderBook(marketState, conversion);
    console.log("asks:", asks)
    console.log("bids:", bids)
    // snapshot for candle chart
    const candles = await snapshotOfCandle("1d", MARKET_PUBKEY)

    console.log("candles:", candles)
    // emitting the event
    // Emit the event with proper structure
    socket.emit("snapshot", {
      market: formatMarketMetadata(marketState),
      orderbook: { asks, bids },
      timestamp: Date.now(),
      candles: {  // Consistent structure
        candles: candles.candles,
        volumeData: candles.volumeData  // Changed to volumeData
      }
    });
    // In your indexer file
    socket.on("resolution", async (data: { resolution: string }) => {
      try {
        const { resolution } = data;
        const candles = await snapshotOfCandle(resolution, MARKET_PUBKEY);

        // FIX: Use consistent structure with frontend
        socket.emit(`resolution:${resolution}`, {
          candles: {
            candles: candles.candles,
            volumeData: candles.volumeData  // Changed from volume to volumeData
          }
        });
      } catch (error) {
        console.error("Error handling resolution change:", error);
      }
    });
    console.log(
      `📸 Snapshot sent to ${socket.id}: ${asks.length} asks, ${bids.length} bids`
    );
    // Start event listener if not already running
    if (!eventCleanup) {
      eventCleanup = await listener.start(async (event) => {
        try {
          // Validate event data before processing
          if (!event || !event.data) {
            console.warn("⚠️ Invalid event data received");
            return;
          }
          console.log("event:",event)
          await OrderEvent(event, io, marketState, socket)

        } catch (error: any) {
          console.error("❌ Error processing event:", error);
          io.emit("error", { message: error.message })
        }
      });
      console.log("🎧 Event listener started");
    }

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      activeConnections.delete(socket.id);

      // If no clients connected, optionally stop listener
      // if (activeConnections.size === 0) {
      //   stopEventListener();
      // }
    });
  } catch (error: any) {
    console.error("❌ Connection error:", error);
    socket.emit("error", {
      message: error.message || "Internal server error",
      timestamp: Date.now(),
    });
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
    status: health.connected ? "ok" : "unhealthy",
    market: MARKET_PUBKEY,
    slot: health.slot,
    connections: activeConnections.size,
    timestamp: Date.now(),
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
      market: formatMarketMetadata(marketState),
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

  // Stop accepting new connections
  io.close();

  // Stop event listener
  await stopEventListener();

  // Clean up all subscriptions
  await listener.cleanup();

  // Close server
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown");
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught errors
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