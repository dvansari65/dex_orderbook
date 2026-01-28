import { useDexProgram } from "@/hooks/useDexProgram"
import { PROGRAM_ID } from "@/lib/programId"
// import { Market } from "@/types/slab"
import { PublicKey } from "@solana/web3.js"
import { useQuery } from "@tanstack/react-query"
import {Orderbook} from "../types/orderbook"
import { IdlAccounts } from "@coral-xyz/anchor"
import { MARKET_PUBKEY } from "@/constants/market"

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

export const useGetOpenOrderPda = (
    market: string | undefined,
    owner: PublicKey | undefined
  ) => {
    console.log("owner",owner)
    if(!market){
        return;
    }
    if(!owner){
        return;
    }
    const marketPubkey = new PublicKey(market);
    
    const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("open_order"),
          marketPubkey.toBuffer(),  
          owner.toBuffer(),   
        ],
        PROGRAM_ID
      );
    return pda
  }
  
  export const useGetMarketAccount = () => {
    const { program } = useDexProgram();
  
    return useQuery<Market>({
      queryKey: ["market"],
      queryFn: async () => {
        try {
          if (!MARKET_PUBKEY) {
            throw new Error("Market pubkey is not provided!");
          }
          console.log("market pub:",MARKET_PUBKEY.toString())
          if (!program) {
            throw new Error("Program is not initialized!");
          }
    
          console.log("Fetching market...");
          const market = await program.account.market.fetch(new PublicKey(MARKET_PUBKEY));
          console.log("Market fetched:", market);
          return market;
        } catch (error) {
          console.log("error:",error)
          throw error;
        }
      },
      enabled: !!MARKET_PUBKEY && !!program,
    });
  };

export const useGetVaultSignerPda = (market: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), market.toBuffer()],
      PROGRAM_ID
    )
    return pda
  }
  