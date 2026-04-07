import { useDexProgram } from "@/hooks/useDexProgram"
import { PROGRAM_ID } from "@/lib/programId"
// import { Market } from "@/types/slab"
import { PublicKey } from "@solana/web3.js"
import { useQuery } from "@tanstack/react-query"
import {Orderbook} from "../types/orderbook"
import { IdlAccounts } from "@coral-xyz/anchor"
import { useNetworkConfig } from "@/providers/NetworkProvider"

type Market = IdlAccounts<Orderbook>["market"]

export const useGetAsksPda = (market: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("asks"), market.toBuffer()],
        PROGRAM_ID
    )
    return pda
}

export const useGetBidsPda = (market: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bids"), market.toBuffer()],
        PROGRAM_ID
    )
    return pda
}
  
export const useGetMarketAccount = () => {
    const { program } = useDexProgram();
    const { marketPubkey, network, rpcUrl } = useNetworkConfig();
  
    return useQuery<Market>({
      queryKey: ["market", network, rpcUrl, marketPubkey],
      queryFn: async () => {
        try {
          if (!marketPubkey) {
            throw new Error("Market pubkey is not provided!");
          }
          if (!program) {
            throw new Error("Program is not initialized!");
          }
          console.log("Fetching market...");
          const market = await program.account.market.fetch(new PublicKey(marketPubkey));
          console.log("Market fetched:", market);
          return market;
        } catch (error) {
          console.log("error:",error)
          throw error;
        }
      },
      enabled: !!marketPubkey && !!program,
    });
};

export const useGetVaultSignerPda = (market: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), market.toBuffer()],
      PROGRAM_ID
    )
    return pda
  }
  
