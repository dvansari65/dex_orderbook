// services/place-order.ts
import { useDexProgram } from "@/hooks/useDexProgram";
import { PlaceOrderInputs } from "@/types/slab";
import { useMutation } from "@tanstack/react-query";
import {
  useGetMarketAccount,
  useGetOpenOrderPda,
} from "../services/blockchain";
import { MARKET_PUBKEY, MAX_BASE_SIZE } from "@/constants/market";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { useCreateTokenAccounts } from "@/hooks/useCreateTokenAccounts";

export const placeOrder = () => {
  const { publicKey } = useWallet();
  const { program } = useDexProgram();
  const openOrderPda = useGetOpenOrderPda(
    MARKET_PUBKEY,
    publicKey ?? undefined
  );
  const marketInfo = useGetMarketAccount(MARKET_PUBKEY);
  const createTokenAccount = useCreateTokenAccounts()
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


        const baseLotSize = marketInfo.data.baseLotSize;
        const quoteLotSize = marketInfo.data.quoteLotSize;

        const convertedMaxBaseSize = MAX_BASE_SIZE * maxBaseSize
        const priceQuoteLots = Math.floor((price * baseLotSize) / quoteLotSize);
        const { signature, baseATA, quoteATA } = await createTokenAccount.mutateAsync({ baseMint: marketInfo.data.baseMint, quoteMint: marketInfo.data.quoteMint })
        console.log("signature:", signature)
        if (!baseATA || !quoteATA) {
          throw new Error("Base ATA or Quote ATA not found!")
        }
        console.log("base ata:",baseATA.toString());
        console.log("quote ata:",quoteATA.toString());
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
            userQuoteVault: quoteATA, // Use the ensured account
            market: MARKET_PUBKEY,
            openOrder: openOrderPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (error) {
        console.log("error:", error);
        throw error;
      }
      // STEP 1: Ensure token accounts exist
    }
  })
}
