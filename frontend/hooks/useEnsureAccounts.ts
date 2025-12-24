// hooks/useEnsureTokenAccounts.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useMutation } from "@tanstack/react-query";

export const useEnsureTokenAccounts = () => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({ baseMint, quoteMint }: { baseMint: PublicKey; quoteMint: PublicKey }) => {
      try {
        if (!publicKey || !signTransaction) {
          throw new Error("Wallet not connected!");
        }
  
        const tx = new Transaction();
        const accounts = {
          base: await getAssociatedTokenAddress(baseMint, publicKey),
          quote: await getAssociatedTokenAddress(quoteMint, publicKey),
        };
  
        // Check if base ATA exists
        const baseAccountInfo = await connection.getAccountInfo(accounts.base);
        if (!baseAccountInfo) {
          console.log("Creating base token account...");
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              accounts.base, // ata
              publicKey, // owner
              baseMint // mint
            )
          );
        }
  
        // Check if quote ATA exists
        const quoteAccountInfo = await connection.getAccountInfo(accounts.quote);
        if (!quoteAccountInfo) {
          console.log("Creating quote token account...");
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              accounts.quote,
              publicKey,
              quoteMint
            )
          );
        }
  
        // Send transaction if we added any instructions
        if (tx.instructions.length > 0) {
          tx.feePayer = publicKey;
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          
          const signed = await signTransaction(tx);
          const signature = await connection.sendRawTransaction(signed.serialize());
          await connection.confirmTransaction(signature, "confirmed");
          
          console.log("Token accounts created:", signature);
          return { signature, accounts };
        }
  
        return { accounts };
      } catch (error) {
        throw error;
      }
    },
  });
};