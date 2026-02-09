import { BN } from "@coral-xyz/anchor";
import { convertNodeOutputType, Market } from "../../types/market";
import { convertEventOutput, Side } from "../../types/events";


export class Conversion {
    marketState: Market | null;
    baseLotSize: number = 0;
    quoteLotSize: number = 0;
    decimals: number = 6;
    constructor(marketState: Market | null) {

        this.marketState = marketState;
        if (marketState) {
            this.baseLotSize = marketState.baseLotSize;
            this.quoteLotSize = marketState.quoteLotSize;
        }
    }
    quantityToHuman(quantity: number) {
        if (!this.marketState) return 0;
        // Phoenix usually uses 1e6 for USDC and 1e9 for SOL, 
        // Ensure you use the actual decimals from the market config
        return (quantity * this.baseLotSize) / Math.pow(10, this.decimals);
    }

    convertNode(node: any):convertNodeOutputType {
        return {
          price: node.price instanceof BN ? node.price.toNumber() : Number(node.price),
          quantity: this.quantityToHuman(node.quantity instanceof BN ? node.quantity.toNumber() : node.quantity),
          orderId: node.orderId instanceof BN ? node?.orderId.toNumber() : Number(node?.orderId)
        };
    }
    convertEvent(event:any):convertEventOutput{
        const side = event.side && "bid" in  event?.side ? Side.Bid : Side.Ask;
        return {
            price:event?.price?.toNumber(),
            side,
            quantity:event?.baseLots?.toNumber()/1000 ,
            timestamp:event?.timestamp?.toNumber(),
            orderId: event?.orderId?.toNumber()
        }
    }
}