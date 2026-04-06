import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import {
  createMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Orderbook } from "../target/types/orderbook";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_BASE_LOT_SIZE = 1_000;
const DEFAULT_QUOTE_LOT_SIZE = 1_000;
const DEFAULT_MAKER_FEES_BPS = 10;
const DEFAULT_TAKER_FEES_BPS = 20;
const DEFAULT_BASE_DECIMALS = 9;
const DEFAULT_QUOTE_DECIMALS = 6;

const parsePublicKey = (value: string | undefined): web3.PublicKey | null => {
  if (!value) return null;
  return new web3.PublicKey(value);
};

async function main() {
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const walletPath =
    process.env.ANCHOR_WALLET ||
    process.env.WALLET ||
    resolve(process.env.HOME || "", ".config/solana/id.json");

  const secretKey = Uint8Array.from(
    JSON.parse(readFileSync(walletPath, "utf8")) as number[]
  );
  const payer = web3.Keypair.fromSecretKey(secretKey);
  const connection = new web3.Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(
    readFileSync(resolve(__dirname, "../target/idl/orderbook.json"), "utf8")
  );
  const program = new Program<Orderbook>(idl, provider);

  const marketKeypair = web3.Keypair.generate();
  const baseVaultKeypair = web3.Keypair.generate();
  const quoteVaultKeypair = web3.Keypair.generate();
  const baseDecimals = Number(process.env.BASE_DECIMALS || DEFAULT_BASE_DECIMALS);
  const quoteDecimals = Number(process.env.QUOTE_DECIMALS || DEFAULT_QUOTE_DECIMALS);

  const baseMint =
    parsePublicKey(process.env.BASE_MINT) ||
    (await createMint(connection, payer, payer.publicKey, null, baseDecimals));
  const quoteMint =
    parsePublicKey(process.env.QUOTE_MINT) ||
    (await createMint(connection, payer, payer.publicKey, null, quoteDecimals));

  const [bidsPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("bids"), marketKeypair.publicKey.toBuffer()],
    program.programId
  );
  const [asksPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("asks"), marketKeypair.publicKey.toBuffer()],
    program.programId
  );
  const [vaultSignerPda, vaultSignerBump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
    program.programId
  );

  const baseLotSize = new BN(
    Number(process.env.BASE_LOT_SIZE || DEFAULT_BASE_LOT_SIZE)
  );
  const quoteLotSize = new BN(
    Number(process.env.QUOTE_LOT_SIZE || DEFAULT_QUOTE_LOT_SIZE)
  );
  const makerFeesBps = new BN(
    Number(process.env.MAKER_FEES_BPS || DEFAULT_MAKER_FEES_BPS)
  );
  const takerFeesBps = new BN(
    Number(process.env.TAKER_FEES_BPS || DEFAULT_TAKER_FEES_BPS)
  );

  const signature = await program.methods
    .initialiseMarket(baseLotSize, quoteLotSize, makerFeesBps, takerFeesBps)
    .accounts({
      market: marketKeypair.publicKey,
      bids: bidsPda,
      asks: asksPda,
      baseVault: baseVaultKeypair.publicKey,
      quoteVault: quoteVaultKeypair.publicKey,
      vaultSigner: vaultSignerPda,
      baseMint,
      quoteMint,
      admin: payer.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([marketKeypair, baseVaultKeypair, quoteVaultKeypair, payer])
    .rpc();

  console.log("Initialise market signature:", signature);
  console.log("Program ID:", program.programId.toBase58());
  console.log("Market:", marketKeypair.publicKey.toBase58());
  console.log("Base Mint:", baseMint.toBase58());
  console.log("Base Decimals:", baseDecimals);
  console.log("Quote Mint:", quoteMint.toBase58());
  console.log("Quote Decimals:", quoteDecimals);
  console.log("Bids PDA:", bidsPda.toBase58());
  console.log("Asks PDA:", asksPda.toBase58());
  console.log("Vault Signer PDA:", vaultSignerPda.toBase58());
  console.log("Vault Signer Bump:", vaultSignerBump);
  console.log("Base Vault:", baseVaultKeypair.publicKey.toBase58());
  console.log("Quote Vault:", quoteVaultKeypair.publicKey.toBase58());
}

main().catch((error) => {
  console.error("Failed to initialize devnet market:", error);
  process.exit(1);
});
