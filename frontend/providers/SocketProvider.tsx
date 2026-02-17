"use client";

import { getSocket } from "@/lib/socket";
import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socket = useMemo(()=>getSocket(),[])

  useEffect(() => {
    const handleOnConnect = ()=>{
      console.log("socket connected!",socket.id)
    }
    socket.on("connect", handleOnConnect);
    socket.on("disconnect", ()=>{
      console.log("socket disconnected!")
    });

    return () => {
      socket.off("connect", handleOnConnect);
      socket.off("disconnect");
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
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