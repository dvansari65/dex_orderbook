import { MarketState, OrderbookEvent } from "./types";


export class InMemoryStorage {
    
    private events: OrderbookEvent[] = [];
    private marketState: Map<string, MarketState> = new Map()

    storeEvent(event: OrderbookEvent) {
        this.events.push(event)
        console.log(`stored event : ${event.type}`);
    }
    updateMarketState(marketState: MarketState, market: string) {
        this.marketState.set(market, marketState);
        console.log(`update market state:${market}`);
    }
    getRecentEvents(limit: number = 100): OrderbookEvent[] {
        return this.events.slice(-limit);
    }
    getMarketState(market: string): MarketState | undefined {
        return this.marketState.get(market)
    }
    getOrderbookSnapShots(market: string) {
        const state = this.marketState.get(market);
        if (!state) {
            return null;
        }
        return {
            bids: state.bids.sort((a, b) => b.price - a.price), // Descending
            asks: state.asks.sort((a, b) => a.price - b.price), // Ascending
            lastUpdate: state.lastUpdate,
        };
    }

}