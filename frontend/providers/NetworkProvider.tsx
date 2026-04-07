"use client";

import {
  AppNetwork,
  DEFAULT_NETWORK,
  NETWORK_MARKET_PUBKEYS,
  NETWORK_RPC_URLS,
} from "@/lib/env";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "phoenix-orderbook-network";

type NetworkContextValue = {
  network: AppNetwork;
  rpcUrl: string;
  marketPubkey: string;
  setNetwork: (next: AppNetwork) => void;
  supportedNetworks: AppNetwork[];
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [network, setNetwork] = useState<AppNetwork>(DEFAULT_NETWORK);

  useEffect(() => {
    const savedNetwork = window.localStorage.getItem(
      STORAGE_KEY
    ) as AppNetwork | null;

    if (savedNetwork && savedNetwork in NETWORK_RPC_URLS) {
      setNetwork(savedNetwork);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, network);
  }, [network]);

  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      rpcUrl: NETWORK_RPC_URLS[network],
      marketPubkey: NETWORK_MARKET_PUBKEYS[network],
      setNetwork,
      supportedNetworks: ["localnet", "devnet", "mainnet-beta"],
    }),
    [network]
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetworkConfig = (): NetworkContextValue => {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetworkConfig must be used within NetworkProvider");
  }

  return context;
};
