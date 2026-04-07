"use client";

import { AppNetwork } from "@/lib/env";
import { PROGRAM_ID } from "@/lib/programId";
import { useNetworkConfig } from "@/providers/NetworkProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Check, Copy, ExternalLink, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const NETWORK_LABELS: Record<AppNetwork, string> = {
  localnet: "Localnet",
  devnet: "Devnet",
  "mainnet-beta": "Mainnet",
};

const shortenAddress = (value: string) =>
  `${value.slice(0, 4)}...${value.slice(-4)}`;

const getExplorerLink = (address: string, network: AppNetwork) => {
  if (network === "mainnet-beta") {
    return `https://explorer.solana.com/address/${address}`;
  }

  return `https://explorer.solana.com/address/${address}?cluster=${network}`;
};

type CopyableAddressProps = {
  label: string;
  value: string;
  network: AppNetwork;
};

function CopyableAddress({ label, value, network }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);
  const hasValue = Boolean(value);

  const handleCopy = async () => {
    if (!hasValue) {
      toast.error(`${label} is not available on this network.`);
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-main)] px-3 py-2 shadow-[var(--phoenix-shadow-sm)]">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--phoenix-text-subtle)]">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-[var(--phoenix-text-primary)]">
          {hasValue ? shortenAddress(value) : "Not configured"}
        </p>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--phoenix-bg-subtle)] text-[var(--phoenix-text-secondary)] transition hover:bg-[var(--phoenix-accent-soft)] hover:text-[var(--phoenix-accent)]"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>

      {hasValue ? (
        <a
          href={getExplorerLink(value, network)}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--phoenix-bg-subtle)] text-[var(--phoenix-text-secondary)] transition hover:bg-[var(--phoenix-accent-soft)] hover:text-[var(--phoenix-accent)]"
          aria-label={`Open ${label} on explorer`}
        >
          <ExternalLink size={15} />
        </a>
      ) : null}
    </div>
  );
}

export default function TradingNavbar() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { marketPubkey, network, setNetwork, supportedNetworks } =
    useNetworkConfig();
  const programId = useMemo(() => PROGRAM_ID.toBase58(), []);

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-glass-strong)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-3 lg:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-full border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-main)] px-4 py-2 shadow-[var(--phoenix-shadow-sm)]"
            >
              <div className="h-3.5 w-3.5 rotate-45 rounded-sm bg-[var(--phoenix-text-primary)]" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--phoenix-text-subtle)]">
                  Phoenix
                </p>
                <p className="text-sm font-semibold text-[var(--phoenix-text-primary)]">
                  Orderbook
                </p>
              </div>
            </Link>

            <div className="rounded-full border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-main)] px-4 py-2 shadow-[var(--phoenix-shadow-sm)]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--phoenix-text-subtle)]">
                Market
              </p>
              <p className="text-sm font-medium text-[var(--phoenix-text-primary)]">
                SOL / USDC
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-main)] px-4 py-2 shadow-[var(--phoenix-shadow-sm)]">
              <label
                htmlFor="trading-network"
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--phoenix-text-subtle)]"
              >
                Network
              </label>
              <select
                id="trading-network"
                value={network}
                onChange={(event) =>
                  setNetwork(event.target.value as AppNetwork)
                }
                className="rounded-full border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--phoenix-text-primary)] outline-none"
              >
                {supportedNetworks.map((item) => (
                  <option key={item} value={item}>
                    {NETWORK_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {connected && publicKey ? (
              <>
                <CopyableAddress
                  label="Wallet"
                  value={publicKey.toBase58()}
                  network={network}
                />
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="rounded-full border border-[var(--phoenix-border-light)] bg-[var(--phoenix-bg-main)] px-4 py-2 text-sm font-medium text-[var(--phoenix-text-primary)] transition hover:bg-[var(--phoenix-bg-subtle)]"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="flex items-center gap-2 rounded-full bg-[var(--phoenix-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--phoenix-accent-hover)]"
              >
                <Wallet size={16} />
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <CopyableAddress label="Market" value={marketPubkey} network={network} />
          <CopyableAddress label="Program" value={programId} network={network} />
        </div>
      </div>
    </div>
  );
}
