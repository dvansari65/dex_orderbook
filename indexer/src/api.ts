import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { EventListener } from "./listener";
import { Conversion } from "./utils/conversion";
import { snapshotOfCandle, handleFillEvent } from "../service/candle";
import { getOrderHistory } from "../service/orderHistory";
import { createOrder } from "../service/orderHistory";
import parseOrderFillEvent from "../helper/parseOrderFillEventData";
import { loadIndexerEnv, resolveDatabaseUrl } from "../lib/env";
import {
  fetchMarketStateForSnapshot,
  getMarketSnapshot,
  invalidateMarketSnapshot,
} from "./service/marketSnapshot";

loadIndexerEnv();

// ─── Config ───────────────────────────────────────────────────────────────────

const NODE_ENV     = process.env.NODE_ENV || "development";
const IS_PROD      = NODE_ENV === "production";
const DATABASE_URL = resolveDatabaseUrl();

const RPC_URL      = process.env.RPC_URL || process.env.LOCAL_URL
const PROGRAM_ID   = process.env.PROGRAM_ID   || "";
const MARKET_PUBKEY = process.env.MARKET_PUBKEY || "";
const PORT         = process.env.PORT         || 3002;

if (!PROGRAM_ID || !MARKET_PUBKEY) {
  if (IS_PROD) {
    console.error("❌ PROGRAM_ID and MARKET_PUBKEY must be set in .env");
    process.exit(1);
  } else {
    console.warn("⚠️PROGRAM_ID or MARKET_PUBKEY not set — running in local dev mode");
  }
}

console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`📡 RPC:         ${RPC_URL}`);
console.log(`🎯 Market:      ${MARKET_PUBKEY || "not set"}`);
console.log(`🗄️ Database:    ${new URL(DATABASE_URL).host}`);

// ─── App Setup ────────────────────────────────────────────────────────────────

export const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["POST", "GET"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Global State ─────────────────────────────────────────────────────────────

const listener              = new EventListener(RPC_URL || "", PROGRAM_ID);
let eventCleanup: (() => Promise<void>) | null = null;
const activeConnections     = new Map<string, Socket>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Event Listener ───────────────────────────────────────────────────────────

const startEventListener = async () => {
  if (eventCleanup) return; // already running

  let cachedMarketState = await fetchMarketStateForSnapshot(listener, MARKET_PUBKEY);

  eventCleanup = await listener.start(async (events) => {
    const payloads = [];

    for (const event of events) {
      if (!event?.data) {
        console.warn("⚠️ Invalid event received");
        continue;
      }

      console.log("📨 Event received:", event.name);

      try {
        if (event.name === "orderPlacedEvent" || event.name === "OrderPlacedEvent") {
          if (!cachedMarketState) {
            cachedMarketState = await fetchMarketStateForSnapshot(listener, MARKET_PUBKEY);
          }
          if (!cachedMarketState) {
            console.error("❌ Market not found while handling orderPlacedEvent");
            continue;
          }
          const conversion = new Conversion(cachedMarketState);
          const converted  = conversion.convertEvent(event.data);
          await createOrder(event.data);
          await invalidateMarketSnapshot(MARKET_PUBKEY);
          payloads.push({
            type: "orderPlacedEvent",
            data: {
              p:  converted.price,
              q:  converted.quantity,
              ts: converted.timestamp,
              s:  converted.side,
              id: converted?.orderId,
            },
          });
        }

        if (
          event.name === "orderFillEvent" ||
          event.name === "OrderFillEvent" ||
          event.name === "orderPartialFillEvent" ||
          event.name === "OrderPartialFillEvent"
        ) {
          const orderFilledEventData = parseOrderFillEvent(event);
          if (!orderFilledEventData) {
            console.error("❌ parseOrderFillEvent returned falsy");
            continue;
          }
          payloads.push({ type: "orderFillEvent", data: orderFilledEventData });

          const fillResult = await handleFillEvent(event.data, event.signature);
          if (!fillResult) {
            io.emit("error", { message: "Failed to create candle for fill event" });
            continue;
          }
          await invalidateMarketSnapshot(MARKET_PUBKEY);
          io.emit("candle:filled", {
            candles:   fillResult.candles,
            volumes:   fillResult.volumes,
            timestamp: fillResult.timestamp,
          });
        }

        if (event.name === "orderCancelledEvent" || event.name === "OrderCancelledEvent") {
          if (!cachedMarketState) {
            cachedMarketState = await fetchMarketStateForSnapshot(listener, MARKET_PUBKEY);
          }
          if (!cachedMarketState) {
            console.error("❌ Market not found while handling OrderCancelledEvent");
            continue;
          }
          const conversion = new Conversion(cachedMarketState);
          const converted  = conversion.convertEvent(event.data);
          await invalidateMarketSnapshot(MARKET_PUBKEY);
          payloads.push({
            type: "OrderCancelledEvent",
            data: {
              p:  converted.price,
              q:  converted.quantity,
              ts: converted.timestamp,
              s:  converted.side,
              id: converted?.orderId,
            },
          });
        }
      } catch (error: any) {
        console.error("❌ Error processing event:", error);
        io.emit("error", { message: error.message });
      }
    }

    if (payloads.length > 0) {
      io.emit("tx:events", payloads);
    }
  });

  console.log("🎧 Event listener started");
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on("connection", async (socket: Socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  activeConnections.set(socket.id, socket);

  try {
    const snapshot = await getMarketSnapshot(listener, MARKET_PUBKEY);
    socket.emit("snapshot", snapshot);

    console.log(
      `📸 Snapshot sent to ${socket.id}: ${snapshot.orderbook.asks.length} asks, ${snapshot.orderbook.bids.length} bids`
    );

    socket.on("user-pubkey", async (pubkey: string) => {
      const orderHistory = await getOrderHistory(pubkey, MARKET_PUBKEY);
      socket.emit("order-history", orderHistory);
    });

    socket.on("resolution", async ({ resolution }: { resolution: string }) => {
      try {
        const candles = await snapshotOfCandle(resolution, MARKET_PUBKEY);
        socket.emit(`resolution:${resolution}`, {
          candles: { candles: candles.candles, volumeData: candles.volumeData },
        });
      } catch (error) {
        console.error("❌ Error handling resolution change:", error);
      }
    });

    // Start event listener once (shared across all connections)
    await startEventListener();

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

// ─── REST Endpoints ───────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  const health = await listener.getConnectionHealth();
  res.json({
    status:      health.connected ? "ok" : "unhealthy",
    market:      MARKET_PUBKEY,
    slot:        health.slot,
    connections: activeConnections.size,
    timestamp:   Date.now(),
  });
});

app.get("/orderbook", async (_req, res) => {
  try {
    const snapshot = await getMarketSnapshot(listener, MARKET_PUBKEY);
    res.json({ ...snapshot, timestamp: Date.now() });
  } catch (error: any) {
    if (error?.message === "Market not found") {
      return res.status(404).json({ error: "Market not found" });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const gracefulShutdown = async () => {
  console.log("\n🛑 Shutting down gracefully...");
  // Stop event listener
  if (eventCleanup) {
    await eventCleanup();
    eventCleanup = null;
  }

  io.close();
  await listener.cleanup();

  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error("⚠️ Forced shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT",  gracefulShutdown);

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});

// ─── Start Server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n✅ Indexer running!`);
  console.log(`📡 HTTP API:  http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🎯 Market:    ${MARKET_PUBKEY}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
