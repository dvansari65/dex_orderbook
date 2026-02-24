import { MARKET_PUBKEY, MAX_BASE_SIZE, MAX_QUOTE_SIZE } from "@/constants/market"
import { useCreateUserTokenAccounts } from "@/hooks/useCreateTokenAccounts"
import { useDexProgram } from "@/hooks/useDexProgram"
import { useGetMarketAccount, useGetOpenOrderPda } from "@/services/blockchain"
import { PlaceOrderInputs } from "@/types/slab"
import { BN } from "@coral-xyz/anchor"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { useWallet } from "@solana/wallet-adapter-react"
import { useMutation } from "@tanstack/react-query"

export const PlaceIOCOrder = () => {
  const { program } = useDexProgram()
  const { publicKey } = useWallet()
  const market = useGetMarketAccount()
  const createTokenAccounts = useCreateUserTokenAccounts()
  
  return useMutation({
    mutationKey: ["place-ioc-order"],
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
        if (!market.data) {
          throw new Error("Market data not found!")
        }
        if (!publicKey) {
          throw new Error("Please connect your wallet!")
        }
        
        // Get open order PDA
        const openOrderPda = useGetOpenOrderPda(MARKET_PUBKEY, publicKey)
        
        // Create user's base and quote token accounts
        const { baseATA, quoteATA } = await createTokenAccounts.mutateAsync({
          baseMint: market.data?.baseMint,
          quoteMint: market.data?.quoteMint
        })

        if (!openOrderPda) {
          throw new Error("Open order not initialised!")
        }
        
        // Convert quantities
        const convertedBaseLots = MAX_BASE_SIZE * maxBaseSize
        const convertedQuotePrice = MAX_QUOTE_SIZE * price
        
        if (!program) {
          console.log("Program not found!")
          return
        }
        
        // Place IOC order - using placeIocOrder method
        const placeIocOrderTx = await program.methods
          .placeIocOrder(
            new BN(convertedBaseLots),
            new BN(convertedQuotePrice),
            orderType, // Should be OrderType.ImmediateOrCancel
            new BN(clientOrderId),
            side
          )
          .accounts({
            market: MARKET_PUBKEY,
            asks: market.data?.asks,
            bids: market.data?.bids,
            eventQueue: market.data?.eventQueue,
            quoteVault: market.data?.quoteVault,
            baseVault: market.data?.baseVault,
            userBaseVault: baseATA,
            userQuoteVault: quoteATA,
            openOrder: openOrderPda,
            owner: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
          
        return placeIocOrderTx
      } catch (error) {
        console.log("error:", error)
        throw error
      }
    }
  })
}