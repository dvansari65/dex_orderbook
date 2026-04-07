export type AppNetwork = "localnet" | "devnet" | "mainnet-beta";

const LOCAL_INDEXER_URL = "http://127.0.0.1:3002";
const LOCALNET_RPC_URL = "http://127.0.0.1:8899";
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeNetwork = (value?: string): AppNetwork => {
  switch (value) {
    case "localnet":
    case "mainnet-beta":
      return value;
    default:
      return "devnet";
  }
};

export const SOCKET_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SOCKET_URL || LOCAL_INDEXER_URL
);

export const DEFAULT_NETWORK = normalizeNetwork(
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK ||
    (process.env.NODE_ENV === "development" ? "localnet" : "devnet")
);

export const NETWORK_RPC_URLS: Record<AppNetwork, string> = {
  localnet: process.env.NEXT_PUBLIC_LOCALNET_RPC_URL || LOCALNET_RPC_URL,
  devnet:
    process.env.NEXT_PUBLIC_DEVNET_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    DEVNET_RPC_URL,
  "mainnet-beta":
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL || MAINNET_RPC_URL,
};

export const NETWORK_MARKET_PUBKEYS: Record<AppNetwork, string> = {
  localnet: process.env.NEXT_PUBLIC_LOCALNET_MARKET_PUBKEY || "",
  devnet:
    process.env.NEXT_PUBLIC_DEVNET_MARKET_PUBKEY ||
    process.env.NEXT_PUBLIC_MARKET_PUBKEY ||
    "",
  "mainnet-beta": process.env.NEXT_PUBLIC_MAINNET_MARKET_PUBKEY || "",
};

export const MARKET_PUBKEY_ENV = NETWORK_MARKET_PUBKEYS.devnet;
