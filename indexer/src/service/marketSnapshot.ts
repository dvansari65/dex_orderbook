import { loadIndexerEnv } from "../../lib/env";
import { EventListener } from "../listener";
import { Conversion } from "../utils/conversion";
import { Market } from "../../types/market";
import { snapshotOfCandle } from "../../service/candle";
import { jsonCache } from "../cache/jsonCache";

const MARKET_SNAPSHOT_KEY_PREFIX = "market-snapshot:v1";

loadIndexerEnv();

export interface OrderbookLevel {
  price: number;
  quantity: number;
  orderId: number;
}

export interface MarketSnapshot {
  market: {
    marketPubkey: string;
    baseLotSize: number;
    quoteLotSize: number;
    baseMint: string;
    quoteMint: string;
  };
  orderbook: {
    asks: OrderbookLevel[];
    bids: OrderbookLevel[];
  };
  candles: {
    candles: Awaited<ReturnType<typeof snapshotOfCandle>>["candles"];
    volumeData: Awaited<ReturnType<typeof snapshotOfCandle>>["volumeData"];
  };
}

const getMarketSnapshotKey = (marketPubkey: string) =>
  `${MARKET_SNAPSHOT_KEY_PREFIX}:${marketPubkey}`;

const fetchOrderBook = async (
  listener: EventListener,
  marketState: Market,
  conversion: Conversion
): Promise<{
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
}> => {
  if (!marketState?.asks || !marketState?.bids) {
    console.error("Invalid market state, asks or bids missing");
    return { asks: [], bids: [] };
  }

  const [askSlabData, bidSlabData] = await Promise.all([
    listener.fetchAskSlabState(marketState.asks.toString()),
    listener.fetchBidSlabState(marketState.bids.toString()),
  ]);

  const convertNodes = (nodes: any[]) =>
    nodes
      .filter((node) => node?.price)
      .map((node) => conversion.convertNode(node));

  return {
    asks: askSlabData?.nodes ? convertNodes(askSlabData.nodes) : [],
    bids: bidSlabData?.nodes ? convertNodes(bidSlabData.nodes) : [],
  };
};

const formatMarketMetadata = (marketPubkey: string, marketState: Market) => ({
  marketPubkey,
  baseLotSize: marketState.baseLotSize,
  quoteLotSize: marketState.quoteLotSize,
  baseMint: marketState.baseMint?.toString(),
  quoteMint: marketState.quoteMint?.toString(),
});

const buildMarketSnapshot = async (
  listener: EventListener,
  marketPubkey: string
): Promise<MarketSnapshot | null> => {
  const marketState = await listener.fetchMarketState(marketPubkey);
  if (!marketState) {
    return null;
  }

  const conversion = new Conversion(marketState);
  const [{ asks, bids }, candles] = await Promise.all([
    fetchOrderBook(listener, marketState, conversion),
    snapshotOfCandle("1d", marketPubkey),
  ]);

  return {
    market: formatMarketMetadata(marketPubkey, marketState),
    orderbook: { asks, bids },
    candles: {
      candles: candles.candles,
      volumeData: candles.volumeData,
    },
  };
};

export const getMarketSnapshot = async (
  listener: EventListener,
  marketPubkey: string
): Promise<MarketSnapshot> =>
  jsonCache.getOrLoad(
    getMarketSnapshotKey(marketPubkey),
    Number(process.env.MARKET_SNAPSHOT_TTL_SECONDS || 5),
    async () => {
      const snapshot = await buildMarketSnapshot(listener, marketPubkey);
      if (!snapshot) {
        throw new Error("Market not found");
      }

      return snapshot;
    }
  );

export const fetchMarketStateForSnapshot = async (
  listener: EventListener,
  marketPubkey: string
): Promise<Market | null> => listener.fetchMarketState(marketPubkey);

export const invalidateMarketSnapshot = async (marketPubkey: string): Promise<void> => {
  await jsonCache.invalidate([getMarketSnapshotKey(marketPubkey)]);
};
