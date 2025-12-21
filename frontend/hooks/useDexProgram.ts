import { AnchorProvider, Program } from "@coral-xyz/anchor"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import idl from "../lib/idl/orderbook.json"

export const useDexProgram = ()=>{
    const {connection} = useConnection()
    const {wallet} = useWallet()
    const provider = new AnchorProvider(connection,wallet as any,{commitment:"confirmed"})
    const program = new Program(idl,provider)
    return {program,provider}
}