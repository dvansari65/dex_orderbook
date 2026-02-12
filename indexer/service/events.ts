import { Market } from "../types/market";
import { Conversion } from "../src/utils/conversion";
import { Server, Socket } from "socket.io";
import { handleFillEvent } from "./candle";
import { OrderFillEventData } from "@/types/events";

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
            console.log("order place price:",event?.data?.price?.toNumber())
            io.emit("order:placed", payload);
        }
        if(event.name == "orderFillEvent" || event.name === "orderPartialFillEvent"){
            const side = event?.data?.side && "bid" in event?.data?.side ? "bid" : "ask"

            const orderFilledEventData:OrderFillEventData = {
                maker:event?.data?.maker?.toString(),
                makerOrderId:event?.data?.makerOrderId?.toNumber(),
                taker:event?.data?.taker?.toString(),
                takerOrderId:event?.data?.takerOrderId?.toNumber(),
                side:side,
                price:event?.data?.price?.toNumber(),
                baseLotsFilled:event?.data?.baseLotsFilled?.toNumber()/1000,
                baseLotsRemaining:event?.data?.baseLotsRemaining.toNumber()/1000,
                timestamp:event?.data?.timestamp.toNumber()
            }
            console.log("orderFilledEventData:",orderFilledEventData)
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