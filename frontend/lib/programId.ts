import { PublicKey } from "@solana/web3.js";
import idl from "../idl/orderbook.json"

export const PROGRAM_ID = new PublicKey(idl.address)

