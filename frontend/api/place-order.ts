// services/place-order.ts
import { useDexProgram } from "@/hooks/useDexProgram";
import { PlaceOrderInputs } from "@/types/slab";
import { useMutation } from "@tanstack/react-query";
import {
  useGetMarketAccount,
  useGetOpenOrderPda,
} from "../services/blockchain";
import { MARKET_PUBKEY, MAX_BASE_SIZE } from "@/constants/market";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";

import { Transaction } from "@solana/web3.js";

export const placeOrder = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { program } = useDexProgram();
  const { connection } = useConnection();
  const openOrderPda = useGetOpenOrderPda(
    MARKET_PUBKEY,
    publicKey ?? undefined
  );
  const marketInfo = useGetMarketAccount(MARKET_PUBKEY);

  return useMutation<any, Error, PlaceOrderInputs>({
    mutationKey: ["placeOrder"],
    mutationFn: async ({
      clientOrderId,
      maxBaseSize,
      price,
      orderType,
      side,
    }: PlaceOrderInputs) => {
      try {
        if (!marketInfo.data) throw new Error("Market info not found!");
        if (!publicKey) throw new Error("Connect your wallet first!");
        if (!openOrderPda) throw new Error("Could not derive open order PDA!");
        if (!program) throw new Error("Program is not initialised!");

        // STEP 1: Ensure token accounts exist

        const baseLotSize = marketInfo.data.baseLotSize.toNumber();
        const quoteLotSize = marketInfo.data.quoteLotSize.toNumber();
        // 1 base token = 1000_000 smallest unit
        const convertedMaxBaseSize = maxBaseSize * MAX_BASE_SIZE;
        const priceQuoteLots = Math.floor((price * baseLotSize) / quoteLotSize);

        const tx = new Transaction()

        const baseATA  = await getAssociatedTokenAddress(marketInfo.data.baseMint,publicKey);
        const quoteAta  = await getAssociatedTokenAddress(marketInfo.data.quoteMint,publicKey)
        if(!baseATA || !quoteAta){
          throw new Error("Quote token or base token mint is not found!")
        }
        const baseInfo = await connection.getAccountInfo(publicKey);
        
        if(!baseInfo){
          tx.add(
             createAssociatedTokenAccountInstruction(publicKey,baseATA,publicKey,program.programId)
          )
        }
        const quoteInfo = await connection.getAccountInfo(quoteAta);
        if(!quoteInfo){
          tx.add(
            createAssociatedTokenAccountInstruction(publicKey,quoteAta,publicKey,program.programId)
          )
        }

        const result = await program.methods
          .placeOrder(
            new BN(convertedMaxBaseSize),
            new BN(clientOrderId),
            new BN(priceQuoteLots),
            orderType,
            side
          )
          .accounts({
            owner: publicKey,
            asks: marketInfo.data.asks,
            bids: marketInfo.data.bids,
            quoteVault: marketInfo.data.quoteVault,
            baseVault: marketInfo.data.baseVault,
            eventQueue: marketInfo.data.eventQueue,
            userBaseVault: baseATA, // Use the ensured account
            userQuoteVault: quoteAta, // Use the ensured account
            market: MARKET_PUBKEY,
            openOrder: openOrderPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
          tx.add(result)
          const {blockhash,lastValidBlockHeight} = await connection.getLatestBlockhash();
          tx.feePayer = publicKey,
          tx.recentBlockhash  = blockhash;
          let signature;
          try {
             signature = await sendTransaction(tx,connection,{ skipPreflight: false, maxRetries: 3 });
          } catch (error) {
            console.log("error:",error)
            throw error;
          }
          await connection.confirmTransaction({signature,blockhash,lastValidBlockHeight})
          return signature;
      } catch (error) {
        throw error;
      }
    },
  });
};
