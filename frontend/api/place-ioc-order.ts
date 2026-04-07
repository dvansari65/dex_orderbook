import { BASE_TOKEN_DECIMALS,QUOTE_TOKEN_DECIMALS } from "@/constants/market"
import { useCreateUserTokenAccounts } from "@/hooks/useCreateTokenAccounts"
import { useDexProgram } from "@/hooks/useDexProgram"
import { useNetworkConfig } from "@/providers/NetworkProvider"
import { useGetMarketAccount } from "@/services/blockchain"
import { PlaceOrderInputs } from "@/types/slab"
import { BN } from "@coral-xyz/anchor"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { useWallet } from "@solana/wallet-adapter-react"
import { useMutation } from "@tanstack/react-query"
import { PublicKey } from "@solana/web3.js"

export const PlaceIOCOrder = () => {
  const { program } = useDexProgram()
  const { publicKey } = useWallet()
  const { marketPubkey, network } = useNetworkConfig()
  const market = useGetMarketAccount()
  const createTokenAccounts = useCreateUserTokenAccounts()
  
  return useMutation({
    mutationKey: ["place-ioc-order", network, marketPubkey],
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
        if (!marketPubkey) {
          throw new Error(`No market is configured for ${network}.`)
        }
        if (market.isLoading) {
          throw new Error("Market is still loading. Please try again in a moment.")
        }
        if (!market.data) {
          throw new Error("Market data not found for the selected network.")
        }
        if (!publicKey) {
          throw new Error("Please connect your wallet!")
        }
        
        // Create user's base and quote token accounts
        const { baseATA, quoteATA } = await createTokenAccounts.mutateAsync({
          baseMint: market.data?.baseMint,
          quoteMint: market.data?.quoteMint
        })
        
        // Convert quantities
        const convertedBaseLots = BASE_TOKEN_DECIMALS * maxBaseSize
        const convertedQuotePrice = QUOTE_TOKEN_DECIMALS * price
        
        if (!program) {
          console.log("Program not found!")
          return
        }
        
        // Place IOC order - using placeIocOrder method
        const placeIocOrderTx = await (program.methods as any)
          .placeIocOrder(
            new BN(convertedBaseLots),
            new BN(convertedQuotePrice),
            orderType, // Should be OrderType.ImmediateOrCancel
            new BN(clientOrderId),
            side
          )
          .accounts({
            market: new PublicKey(marketPubkey),
            asks: market.data?.asks,
            bids: market.data?.bids,
            quoteVault: market.data?.quoteVault,
            baseVault: market.data?.baseVault,
            userBaseVault: baseATA,
            userQuoteVault: quoteATA,
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
