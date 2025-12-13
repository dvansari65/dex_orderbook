import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { EventListener } from "./listener";
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
const clentSubscriptions = new Map<string,any[]>()

const listener = new EventListener(RPC_URL, PROGRAM_ID);

io.on("connect", async (socket) => {
    console.log("frontend connected:", socket.id);

    try {
        const marketState = await listener.fetchMarketState(MARKET_PUBKEY);
    
        if (!marketState) {
          socket.emit("error", { message: "Market not found!" });
          return;
        }
    
        // Ask aur Bid slab data parallel fetch karo
        const [askSlabData, bidSlabData] = await Promise.all([
          listener.fetchAskSlabState(marketState.asks as string),
          listener.fetchBidSlabState(marketState.bids as string)
        ]);
    
        // Initial snapshot bhejo
        socket.emit("initial-snapshot", {
          market: marketState,
          asks: askSlabData,
          bids: bidSlabData,
          success: true,
          timestamp: Date.now()
        });

    } catch (error:any) {
        socket.emit("error",{message:error.message || "Something went wrong!"})
        return;
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
