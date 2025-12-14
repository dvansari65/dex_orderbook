import { SocketProvider } from "@/providers/SocketProvider";
import { ReactNode } from "react";

export const  AppProvider = ({children}:{children:ReactNode})=>{
    return (
        <SocketProvider>
            {children}
        </SocketProvider>
    )
}