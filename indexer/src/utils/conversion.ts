import { BN } from "@coral-xyz/anchor";
import { Market, Node } from "../../types/market";


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

    convertNode(node: any) {
        // Handle side carefully - Phoenix sides are often enums (0, 1)
        let side = node.side;
        if (typeof side === 'object') {
            side = Object.keys(side)[0]; // handles { ask: {} } format
        }

        return {
          price: node.price instanceof BN ? node.price.toNumber() : Number(node.price),
          quantity: this.quantityToHuman(node.quantity instanceof BN ? node.quantity.toNumber() : node.quantity),
          side: side?.toLowerCase(), // "ask" or "bid"
        };
    }
}