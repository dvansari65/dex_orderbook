import { useQuery } from "@tanstack/react-query"
import {PublicKey} from "@solana/web3.js"
import { MARKET_PUBKEY } from "@/constants/market";
import { useDexProgram } from "@/hooks/useDexProgram";

export const fetchOrderAccount = (userPublicKey:PublicKey | null)=>{
    const {program} = useDexProgram()
    return useQuery({
        queryKey:["open_order",userPublicKey],
        queryFn:async()=>{
            try {
                if(!userPublicKey){
                    return;
                }
                if(!program){
                    return;
                }
                const marketKey = new PublicKey(MARKET_PUBKEY);
                const [openOrderPda] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("open_order"),
                        marketKey.toBuffer(),
                        userPublicKey.toBuffer()
                    ],
                    program?.programId
                )
                const openOrder = await program.account.openOrders.fetch(openOrderPda);
                return openOrder;
            } catch (error) {
                console.error(error);
                throw error;
            }
        }
    })
}