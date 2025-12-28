import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { EventListener } from "./listener";
import { Conversion } from "./utils/conversion";
import { Market, Slab } from "../types/market";
dotenv.config();
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const PROGRAM_ID = process.env.PROGRAM_ID || "";
const MARKET_PUBKEY =
  process.env.MARKET_PUBKEY || "36QegbcReiokCfEaKYQYbvAvmVFtvai2WFAVSz6yn3T3";
console.log("market pub key", MARKET_PUBKEY);

export const app = express();
app.use(cors);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["POST", "GET"],
  },
});

const listener = new EventListener(RPC_URL, PROGRAM_ID);

const fetchOrderBook = async (
  marketState: Market | null,
  conversion: Conversion
) => {
  const [askSlabData, bidSlabData] = await Promise.all([
    listener.fetchAskSlabState(marketState?.asks || ""),
    listener.fetchBidSlabState(marketState?.bids || ""),
  ]);
  const convertedAskData = askSlabData
    ? {
        headIndex: askSlabData?.headIndex || 0,
        freeListLen: askSlabData?.freeListLen || 32,
        leafCount: askSlabData?.leafCount || 32,
        nodes: askSlabData?.nodes.map((node) => conversion.convertNode(node)),
      }
    : {
        headIndex: null,
        freeListLen: null,
        leafCount: null,
        nodes: [],
      };
  const convertedBidData = bidSlabData
    ? {
        headIndex: bidSlabData?.headIndex || 0,
        freeListLen: bidSlabData?.freeListLen || 32,
        leafCount: bidSlabData?.leafCount || 32,
        nodes: bidSlabData?.nodes.map((node) => conversion.convertNode(node)),
      }
    : {
        headIndex: null,
        freeListLen: null,
        leafCount: null,
        nodes: [],
      };
  return {
    asks: convertedAskData,
    bids: convertedBidData,
  };
};

io.on("connect", async (socket) => {
  console.log("frontend connected:", socket.id);

  try {
    console.log("market key:", MARKET_PUBKEY);

    const marketState = await listener.fetchMarketState(MARKET_PUBKEY);
    if (!marketState) {
      socket.emit("error", { message: "Market not found!" });
      return;
    }
    const conversion = new Conversion(marketState);

    const { asks, bids } = await fetchOrderBook(marketState, conversion);

    if (!asks || !bids) {
      console.log("data is not converted at all!");
      socket.emit("error", { message: "Ask and bid is not converted at all!" });
    }
    console.log("ask slab:",asks)

    socket.emit("initial-snapshot", {
      market: marketState,
      asks: bids,
      bids: bids,
      success: true,
      timestamp: Date.now(),
    });

    // Stream program events live
    await listener.start(async (event) => {
      console.log("event from api:", event);
      const updatedOrderbook = await fetchOrderBook(marketState, conversion);
      socket.emit("orderbook-update", {
        asks: updatedOrderbook.asks,
        bids: updatedOrderbook.bids,
        event: event.name,
        timestamp: Date.now(),
      });
    });
    // cancel on disconnect
    socket.on("disconnect", () => {
      console.log("Frontend disconnected:", socket.id);
    });
    
  } catch (error: any) {
    socket.emit("error", { message: error.message || "Something went wrong!" });
  }

  socket.on("disconnect", () => {
    console.log("Frontend disconnected:", socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`📡 Indexer API: http://localhost:${PORT}`);
  console.log(`🔌 Socket.io: ws://localhost:${PORT}`);
});
