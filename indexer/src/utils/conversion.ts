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
        if (!this.marketState) {
            return;
        }
        return (
            (quantity * this.marketState.baseLotSize) / 1000000
        )
    }
    convertNode(node: any) {
        return {
            price: node.price instanceof BN ? node.price.toNumber() : Number(node.price),
            quantity: node.quantity instanceof BN ? this.quantityToHuman(node?.quantity) : this.quantityToHuman(node?.quantity),
            owner: Array.isArray(node.owner)
                ? node.owner[0].toString()
                : node.owner.toString(),
            clientOrderId: node.clientOrderId instanceof BN
                ? node.clientOrderId.toString()
                : String(node.clientOrderId),
            timestamp: node.timestamp instanceof BN
                ? node.timestamp.toNumber()
                : Number(node.timestamp),
            orderId: node.orderId instanceof BN
                ? node.orderId.toString()
                : String(node.orderId),
            next: node.next,
            prev: node.prev,
        }
    }
}