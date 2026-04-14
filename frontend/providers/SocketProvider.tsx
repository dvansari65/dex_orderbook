"use client";

import { getSocket } from "@/lib/socket";
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socket = useMemo(() => getSocket(), []);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => {
      console.log("socket connected!", socket.id);
      setIsConnected(true);
    };

    const handleDisconnect = (reason: string) => {
      console.log("socket disconnected!", reason);
      setIsConnected(false);
    };

    setIsConnected(socket.connected);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): Socket => {
  const { socket } = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return socket;
};

export const useSocketStatus = (): boolean => {
  const { isConnected } = useContext(SocketContext);
  return isConnected;
};