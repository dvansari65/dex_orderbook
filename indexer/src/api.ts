import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { EventListener } from "./listener";
import { Conversion } from "./utils/conversion";
import  { Slab } from "../types/market";
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
const clentSubscriptions = new Map<string, any[]>()

const listener = new EventListener(RPC_URL, PROGRAM_ID);

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
      
        let askSlabData: Slab | null = null;
        let bidSlabData: Slab | null = null;
      
        // Fetch slabs once before first snapshot
        const fetchSlabs = async () => {
          const [asks, bids] = await Promise.all([
            listener.fetchAskSlabState(marketState.asks as string),
            listener.fetchBidSlabState(marketState.bids as string)
          ]);
          askSlabData = asks;
          bidSlabData = bids;
        };
      
        await fetchSlabs(); // 🔥 ensure slabs exist before initial emit
      
        const buildConverted = () => {
          const convertedAsk = askSlabData
            ? {
                headIndex: askSlabData.headIndex,
                freeListLen: askSlabData.freeListLen,
                leafCount: askSlabData.leafCount,
                nodes: askSlabData.nodes.map(n => conversion.convertNode(n))
              }
            : {
                headIndex: null,
                freeListLen: null,
                leafCount: null,
                nodes: []
              };
      
          const convertedBid = bidSlabData
            ? {
                headIndex: bidSlabData.headIndex,
                freeListLen: bidSlabData.freeListLen,
                leafCount: bidSlabData.leafCount,
                nodes: bidSlabData.nodes.map(n => conversion.convertNode(n))
              }
            : {
                headIndex: null,
                freeListLen: null,
                leafCount: null,
                nodes: []
              };
      
          return { convertedAsk, convertedBid };
        };
      
        // Emit initial snapshot
        const { convertedAsk, convertedBid } = buildConverted();
        socket.emit("initial-snapshot", {
          market: marketState,
          asks: convertedAsk,
          bids: convertedBid,
          success: true,
          timestamp: Date.now()
        });
      
        // Start periodic slab refresh
        const intervalId = setInterval(async () => {
          await fetchSlabs();
          const { convertedAsk, convertedBid } = buildConverted();
          socket.emit("update-snapshot", {
            asks: convertedAsk,
            bids: convertedBid,
            timestamp: Date.now()
          });
        }, 2000);
      
        // cancel on disconnect
        socket.on("disconnect", () => {
          console.log("Frontend disconnected:", socket.id);
          clearInterval(intervalId);
        });
      
        // Stream program events live
        await listener.start((event) => {
          socket.emit("market-event", event);
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
