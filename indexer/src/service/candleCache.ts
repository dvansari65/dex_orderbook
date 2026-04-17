import { loadIndexerEnv } from "../../lib/env";
import { jsonCache } from "../cache/jsonCache";

const CANDLE_SNAPSHOT_KEY_PREFIX = "candle-snapshot:v1";
const SNAPSHOT_RESOLUTIONS = ["1m", "5m", "1h", "1d"] as const;

loadIndexerEnv();

export const getCandleSnapshotKey = (marketPubkey: string, resolution: string) =>
  `${CANDLE_SNAPSHOT_KEY_PREFIX}:${marketPubkey}:${resolution}`;

export const getCandleSnapshotTtlSeconds = (): number =>
  Number(process.env.CANDLE_SNAPSHOT_TTL_SECONDS || 5);

export const invalidateCandleSnapshots = async (marketPubkey: string): Promise<void> => {
  await jsonCache.invalidate(
    SNAPSHOT_RESOLUTIONS.map((resolution) => getCandleSnapshotKey(marketPubkey, resolution))
  );
};
