"use client"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";

import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import idl from "../idl/orderbook.json"
import { Orderbook } from "@/types/orderbook";
import { useMemo } from "react";

export const useDexProgram = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
  
    const provider = useMemo(() => {
      if (!wallet.wallet) return null;
  
      return new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );
    }, [connection, wallet]);
  
    const program = useMemo(() => {
      if (!provider) return null;
  
      return new Program<Orderbook>(
        idl as Orderbook,
        provider
      );
    }, [provider]);
  
    return { program, provider };
  };