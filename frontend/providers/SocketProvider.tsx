"use client"
import { initialiseSocket } from "@/lib/socket";
import { ReactNode, useContext, useEffect } from "react";
import { createContext } from "react";


interface socketProviderProps {
    children:ReactNode
}

const SocketContext = createContext<ReturnType<typeof initialiseSocket> | null>(null)

export const SocketProvider = ({children}:socketProviderProps)=>{
    const socket = initialiseSocket()
    useEffect(()=>{
        socket.connect();
        return ()=>{
            socket.disconnect()
        }
    },[])
    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    )
}

export const useSocket = ()=>{
    const socket = useContext(SocketContext)
    if(!socket){
        throw new Error("useSocket must be used within SocketProvider")
    }
    return socket;
}