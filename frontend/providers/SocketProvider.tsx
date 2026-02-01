"use client";

import { getSocket, destroySocket } from "@/lib/socket";
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  if (!socketRef.current) {
    socketRef.current = getSocket();
  }

  useEffect(() => {
    const socket = socketRef.current!;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => console.error("[Socket] connection error:", err);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      destroySocket();
    };
  }, []);

  return (
    <SocketContext.Provider value={connected ? socketRef.current : null}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): Socket => {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used within SocketProvider or socket is not yet connected");
  }
  return socket;
};