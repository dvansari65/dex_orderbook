import { MARKET_PUBKEY, MAX_BASE_SIZE } from "@/constants/market"
import { useCreateUserTokenAccounts } from "@/hooks/useCreateTokenAccounts"
import { useDexProgram } from "@/hooks/useDexProgram"
import { useGetMarketAccount, useGetOpenOrderPda } from "@/services/blockchain"
import { PlaceOrderInputs } from "@/types/slab"
import { BN } from "@coral-xyz/anchor"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { useWallet } from "@solana/wallet-adapter-react"
import { useMutation } from "@tanstack/react-query"

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
        const baseLotSize = market.data?.baseLotSize;
        const quoteLotSize = market.data?.quoteLotSize;
        const convertedBaseLots = MAX_BASE_SIZE * maxBaseSize;
        const convertedQuoteLots = Math.floor((price * baseLotSize) / quoteLotSize);

        const placeOrderTx = await program?.methods
          .placeOrder(
            new BN(convertedBaseLots),
            new BN(clientOrderId),
            new BN(convertedQuoteLots),
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