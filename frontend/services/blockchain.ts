import { useDexProgram } from "@/hooks/useDexProgram"
import { PROGRAM_ID } from "@/lib/programId"
import { Market } from "@/types/slab"
import { PublicKey } from "@solana/web3.js"


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
  
export const useGetMarketAcount = (marketPubKey:string):Market=>{
    const {program} = useDexProgram()
    try {
        if(!marketPubKey){
            throw new Error("Market pubkey is not provided!")
        }
        const market = (program.account as any).market.fetch(marketPubKey)
        console.log("market account:",market)
        return market
    } catch (error) {
        throw error;
    }
}

export const useGetVaultSignerPda = (market: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), market.toBuffer()],
      PROGRAM_ID
    )
    return pda
  }
  