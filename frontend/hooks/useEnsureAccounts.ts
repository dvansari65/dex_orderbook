// hooks/useEnsureTokenAccounts.ts
"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Transaction, PublicKey, SendTransactionError } from "@solana/web3.js";
import { useMutation } from "@tanstack/react-query";

export const useEnsureTokenAccounts = () => {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({
      baseMint,
      quoteMint,
    }: {
      baseMint: PublicKey;
      quoteMint: PublicKey;
    }) => {
      if (!publicKey) throw new Error("⚠ Wallet is not connected");

      const accounts = {
        base: await getAssociatedTokenAddress(baseMint, publicKey),
        quote: await getAssociatedTokenAddress(quoteMint, publicKey),
      };

      const tx = new Transaction();

      // 1️⃣ Base ATA
      const baseInfo = await connection.getAccountInfo(accounts.base);
      if (!baseInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,      // payer
            accounts.base,  // ATA
            publicKey,      // owner
            baseMint        // mint
          )
        );
      }

      // 2️⃣ Quote ATA
      const quoteInfo = await connection.getAccountInfo(accounts.quote);
      if (!quoteInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            accounts.quote,
            publicKey,
            quoteMint
          )
        );
      }

      // 3️⃣ If nothing to create → return immediately
      if (tx.instructions.length === 0) {
        return { accounts, created: false };
      }

      // 4️⃣ Build + Sign Tx
      tx.feePayer = publicKey;
      const latest = await connection.getLatestBlockhash();
      tx.recentBlockhash = latest.blockhash;

      let signedTx;

      try {
        // Prefer browser-injected wallet signing
        if (signTransaction) {
          signedTx = await signTransaction(tx);
        } else if (sendTransaction) {
          // Some wallets only expose sendTransaction (e.g. Ledger / mobile Phantom)
          const sig = await sendTransaction(tx, connection, { skipPreflight: false });
          await connection.confirmTransaction(sig, "confirmed");
          return { accounts, signature: sig, created: true };
        } else {
          throw new Error("Wallet does not support signing transactions");
        }
      } catch (err: any) {
        console.error("❌ Signing failed:", err);
        throw new Error("Failed to sign token account creation transaction");
      }

      // 5️⃣ Send Transaction
      let signature: string;
      try {
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
        });
      } catch (err: any) {
        // Capture logs to help debugging
        if (err instanceof SendTransactionError) {
          console.error("🚨 Transaction logs:", await err.getLogs(connection));
        }
        console.error("❌ sendRawTransaction error:", err);
        throw new Error("Failed to submit transaction — check wallet balance for rent");
      }

      // 6️⃣ Confirm
      try {
        await connection.confirmTransaction(
          { signature, ...latest },
          "confirmed"
        );
      } catch (err) {
        console.error("❌ Confirm failed:", err);
        throw new Error("Transaction broadcasted but confirmation failed");
      }

      return { accounts, signature, created: true };
    },
  });
};
