const LOCAL_INDEXER_URL = "http://127.0.0.1:3002";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const SOCKET_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SOCKET_URL || LOCAL_INDEXER_URL
);

export const MARKET_PUBKEY_ENV = process.env.NEXT_PUBLIC_MARKET_PUBKEY || "";
