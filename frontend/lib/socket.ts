import io from "socket.io-client";

let socket : ReturnType<typeof io>

export const initialiseSocket = ()=>{
    socket = io(process.env.NEXT_SOCKET_URL || "http://localhost:3001")
    return socket;
}


export const getSocket = ()=>{
    if(!socket) throw new Error("socket not found!")
    return socket;
}