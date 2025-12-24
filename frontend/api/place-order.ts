// services/place-order.ts
import { useDexProgram } from "@/hooks/useDexProgram";
import { PlaceOrderInputs } from "@/types/slab";
import { useMutation } from "@tanstack/react-query";
import { useGetMarketAccount, useGetOpenOrderPda } from "../services/blockchain";
import { MARKET_PUBKEY, MAX_BASE_SIZE } from "@/constants/market";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { useEnsureTokenAccounts } from "@/hooks/useEnsureAccounts";


export const placeOrder = () => {
  const { publicKey } = useWallet();
  const { program } = useDexProgram();
  const openOrderPda = useGetOpenOrderPda(MARKET_PUBKEY, publicKey ?? undefined);
  const marketInfo = useGetMarketAccount(MARKET_PUBKEY);
  const { mutateAsync: ensureAccounts } = useEnsureTokenAccounts();

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
        console.log("Ensuring token accounts exist...");
        const { accounts } = await ensureAccounts({
          baseMint: marketInfo.data.baseMint,
          quoteMint: marketInfo.data.quoteMint,
        });

        console.log("max base size:",maxBaseSize)
        console.log("price:",price)
        const baseLotSize  = marketInfo.data.baseLotSize.toNumber();
        const quoteLotSize = marketInfo.data.quoteLotSize.toNumber();
        // 1 base token = 1000_000 smallest unit
        const convertedMaxBaseSize = maxBaseSize*MAX_BASE_SIZE;
        const priceQuoteLots = Math.floor(
          (price * baseLotSize) / quoteLotSize
        );
       
        console.log("masx base size:",priceQuoteLots)
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
            userBaseVault: accounts.base,  // Use the ensured account
            userQuoteVault: accounts.quote, // Use the ensured account
            market: MARKET_PUBKEY,
            openOrder: openOrderPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        return result;
      } catch (error) {
        throw error;
      }
    },
  });
};