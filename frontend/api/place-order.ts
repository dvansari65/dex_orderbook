import { MARKET_PUBKEY, QUOTE_TOKEN_DECIMALS, BASE_TOKEN_DECIMALS } from "@/constants/market"
import { useCreateUserTokenAccounts } from "@/hooks/useCreateTokenAccounts"
import { useDexProgram } from "@/hooks/useDexProgram"
import { useGetMarketAccount, useGetOpenOrderPda } from "@/services/blockchain"
import { PlaceOrderInputs } from "@/types/slab"
import { BN } from "@coral-xyz/anchor"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { useWallet } from "@solana/wallet-adapter-react"
import { useMutation } from "@tanstack/react-query"
// place limit order 
export const PlaceOrder = () => {
  const { program } = useDexProgram()
  const {publicKey} = useWallet()
  const market = useGetMarketAccount()
  const createTokenAccounts  = useCreateUserTokenAccounts()
  return useMutation({
    mutationKey: ["place-order"],
    mutationFn: async (
      {
        clientOrderId,
        maxBaseSize,
        price,
        orderType,
        side,
      }: PlaceOrderInputs
    ) => {
      try {
        if(!market.data){
          throw new Error("Market data not found!")
        }
        if(!publicKey){
          throw new Error("Please connect you wallet!")
        }
        // getting open order pda
        const openOrderPda = useGetOpenOrderPda(MARKET_PUBKEY,publicKey)
        // creating user's base associated token account and quote associated token account
        const {baseATA,quoteATA} = await createTokenAccounts.mutateAsync({
          baseMint:market.data?.baseMint,
          quoteMint:market?.data?.quoteMint
        });

        if(!openOrderPda){
          throw new Error("Open order not initialised!")
        }
        
        const convertedBaseLots = BASE_TOKEN_DECIMALS * maxBaseSize;
        const convertedQuotePrice = QUOTE_TOKEN_DECIMALS * price
        if(!program){
          console.log("Program not found!")
          return;
        }
        // sending user's price at the smart contract , will convert it into quote lot 
        const placeOrderTx = await (program.methods as any)
          .placeLimitOrder(
            new BN(convertedBaseLots),
            new BN(clientOrderId),
            new BN(convertedQuotePrice),
            orderType,
            side
          )
          .accounts({
            market: MARKET_PUBKEY,
            asks: market.data?.asks,
            bids: market.data?.bids,
            quoteVault: market?.data?.quoteVault,
            baseVault: market?.data?.baseVault,
            eventQueue: market.data?.eventQueue,
            userBaseVault: baseATA, // Use the ensured account
            userQuoteVault: quoteATA, // Use the ensured account
            openOrder: openOrderPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
          return  placeOrderTx;
      } catch (error) {
        console.log("error:",error)
        throw error;
      }
    }
  })
}