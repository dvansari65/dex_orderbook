import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectToIndexer = () => {
    if (!socket) {
        socket = io(process.env.NEXT_SOCKET_URL || "http://localhost:3001", {
            transports: ["websocket"],
            autoConnect: true,
        });
        socket.on("connect", () => {
            console.log("Connected to indexer:", socket?.id);
        });
        socket.on("disconnect", () => {
            console.log("Disconnected from indexer");
        });

        return socket;
    }
    return socket;
};

export const getSocket = () => {
    return socket;
};

export function disconnectIndexer() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
