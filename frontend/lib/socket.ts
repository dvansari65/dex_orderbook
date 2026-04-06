import io, { Socket } from "socket.io-client";
import { SOCKET_URL } from "./env";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
  }
  return socket;
};
