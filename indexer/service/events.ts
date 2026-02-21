import { Market } from "../types/market";
import { Conversion } from "../src/utils/conversion";
import { Server, Socket } from "socket.io";
import { handleFillEvent } from "./candle";
import parseOrderFillEvent from "../helper/parseOrderFillEventData"
import { createOrder } from "./orderHistory";

export const OrderEvent = async (event: any, io: Server, Market: Market | null, socket: Socket) => {
    if (!Market) {
        throw new Error("Market data not found!");
    }
    
    try {
        const conversion = new Conversion(Market);
        const converted = conversion.convertEvent(event?.data);
        
        // Lightweight event payload
        const payload = {
            p: converted.price,
            q: converted.quantity,
            ts: converted.timestamp,
            s: converted.side,
            id:converted?.orderId
        };
        
        if (event.name === "orderPlacedEvent") {
            await createOrder(event?.data);
            io.emit("order:placed", payload);
        }
        if(event.name == "orderFillEvent" || event.name === "orderPartialFillEvent"){
            const orderFilledEventData = parseOrderFillEvent(event)
            io.emit("order:filled", orderFilledEventData);

            const fillResult = await handleFillEvent(event?.data, event?.signature);
            if (!fillResult) {
                io.emit("error", { message: "Failed to create candle for order fill event!" });
                return;
            }
            // Emit candle data with volume
            io.emit("candle:filled", {
                candle: fillResult.candle,
                volume: fillResult.volume,
                timestamp: fillResult.timestamp
            });
        }
        if (event.name === "OrderCancelledEvent") {
            io.emit("order:cancelled", payload);
        }
        
    } catch (error: any) {
        console.log("Error in OrderEvent:", error);
        socket.emit("error", { 
            message: error.message || "Something went wrong!" 
        });
        throw error;
    }
}