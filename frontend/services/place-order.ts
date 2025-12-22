import { useDexProgram } from "@/hooks/useDexProgram";
import { PlaceOrderInputs } from "@/types/slab";
import { useMutation } from "@tanstack/react-query";
import { useGetMarketAcount, useGetOpenOrderPda } from "./blockchain";
import { MARKET_PUBKEY } from "@/constants/market";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";

export const placeOrder = () => {
    console.log("market pub key:", MARKET_PUBKEY);

    // Get publicKey from wallet hook at the top level
    const { publicKey } = useWallet();
    const { program } = useDexProgram();

    // Use publicKey from useWallet, not from program.provider
    const openOrderPda = useGetOpenOrderPda(
        MARKET_PUBKEY,
        publicKey ?? undefined
    );
    const marketInfo = useGetMarketAcount(MARKET_PUBKEY);

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
                if (!marketInfo) {
                    throw new Error("Market info not found!");
                }
                if (!publicKey) {
                    throw new Error("Connect your wallet first!");
                }
                if (!openOrderPda) {
                    throw new Error("Could not derive open order PDA!");
                }
                if (
                    clientOrderId == null ||
                    maxBaseSize == null ||
                    price == null ||
                    orderType == null ||
                    side == null
                ) {
                    throw new Error("Inputs are missing!");
                }

                if (!program) {
                    throw new Error("Program is not initialised!");
                }

                const result = await program.methods
                    .placeOrder(new BN(clientOrderId), new BN(maxBaseSize), new BN(price), orderType, side)
                    .accounts({
                        owner: publicKey, // Use publicKey from useWallet
                        asks: new PublicKey(marketInfo.asks),
                        bids: new PublicKey(marketInfo.bids),
                        quoteVault: new PublicKey(marketInfo.quoteVault),
                        baseVault: new PublicKey(marketInfo.baseVault),
                        eventQueue: new PublicKey(marketInfo.eventQueue),
                        userBaseVault: marketInfo.baseMint,
                        userQuoteVault: marketInfo.quoteMint,
                        market: MARKET_PUBKEY,
                        openOrder: openOrderPda, // Already a PublicKey, no need for new PublicKey()
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
