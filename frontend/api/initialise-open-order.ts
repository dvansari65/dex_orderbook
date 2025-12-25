import { useDexProgram } from "@/hooks/useDexProgram";
import { MARKET_PUBKEY } from "@/constants/market";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation } from "@tanstack/react-query";
import { useGetOpenOrderPda } from "@/services/blockchain";

export const useInitializeOpenOrder = () => {
    const { program } = useDexProgram();
    const { publicKey } = useWallet();
    const pda  = useGetOpenOrderPda(MARKET_PUBKEY,publicKey!)
    return useMutation<string, Error>({
        mutationKey: ["initializeOpenOrder"],
        mutationFn: async () => {
            try {
                if (!program) {
                    throw new Error("Program not initialized");
                }
                if (!publicKey) {
                    throw new Error("Connect your wallet first");
                }
                if(!pda){
                    throw new Error("Open order pda not found!")
                }
    
                // Call initialize instruction
               const tx =  await program.methods
                    .initializeOpenOrder()
                    .accounts({
                        openOrder: pda,
                        market: MARKET_PUBKEY,
                        owner: publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
                console.log("open order tx:",tx)
                return tx;
            } catch (error) {
                throw error;
            }
        },
    });
};
