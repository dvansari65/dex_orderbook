import express from "express"
import cors from "cors"
import { createServer } from "http"
import { Server } from "socket.io"
import { InMemoryStorage } from "./storage"
import dotenv from "dotenv"

dotenv.config();
const app = express()
app.use(cors)

const server = createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["POST", "GET"]
    }
})

let storage: InMemoryStorage;

export const setupApi = (storageInstance: InMemoryStorage) => {
    storage = storageInstance
}

io.on("connect", (socket) => {
    console.log("frontend connected:", socket.id);
    const market = process.env.MARKET_PUBKEY;
    socket.on("disconnect", () => {
        console.log('Frontend disconnected:', socket.id);
    })

})
export function broadcast(event: string, data: any) {
    io.emit(event, data);
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`📡 Indexer API: http://localhost:${PORT}`);
    console.log(`🔌 Socket.io: ws://localhost:${PORT}`);
})
