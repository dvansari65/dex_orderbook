import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { Orderbook } from "../target/types/orderbook";
import { 
  TOKEN_PROGRAM_ID, 
  createMint // Import this to actually create mints
} from "@solana/spl-token";
import { assert } from "chai";

describe("orderbook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet; // Explicit cast for TS

  it("Initializes the market!", async () => {
    // 1️⃣ Generate Keypairs for all accounts we are initializing
    const marketKeypair = web3.Keypair.generate();
    const bidsKeypair = web3.Keypair.generate();
    const asksKeypair = web3.Keypair.generate();
    const eventQueueKeypair = web3.Keypair.generate();
    console.log("marketKeypair",marketKeypair.publicKey.toString())
    // Keypairs for the Vaults (Must be Keypairs, not just PublicKeys)
    const baseVaultKeypair = web3.Keypair.generate();
    const quoteVaultKeypair = web3.Keypair.generate();

    // 2️⃣ Create ACTUAL Token Mints on-chain
    // We cannot just generate a keypair, we must ask the Token Program to create the mint account
    const baseMint = await createMint(
      provider.connection,
      payer.payer, // The actual Keypair of the wallet
      payer.publicKey, // Mint authority
      null, // Freeze authority
      6 // Decimals
    );

    const quoteMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6
    );

    // 3️⃣ PDA for vault signer
    // Note: Anchor usually resolves this automatically if seeds are clear, 
    // but passing it explicitly is safe.
    const [vaultSigner, vaultBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    // 4️⃣ Call initializeMarket
    const tx = await program.methods
      .initialiseMarket(
        new BN(1000),
        new BN(1000),
        new BN(10),
        new BN(20)
      )
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsKeypair.publicKey,
        asks: asksKeypair.publicKey,
        eventQueue: eventQueueKeypair.publicKey,
        
        // Pass the public keys
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        
        // Pass the actual mints created in Step 2
        baseMint: baseMint,
        quoteMint: quoteMint,
        
        admin: payer.publicKey,
        
        // System programs are usually inferred, but good to ensure they exist
        // systemProgram: web3.SystemProgram.programId,
        // tokenProgram: TOKEN_PROGRAM_ID,
        
        // // Anchor usually derives this, but you can pass it to be explicit
        // vaultSigner: vaultSigner, 
      })
      // 5️⃣ SIGNERS: Every account marked #[account(init)] needs to be here
      .signers([
        marketKeypair, 
        bidsKeypair, 
        asksKeypair, 
        eventQueueKeypair,
        baseVaultKeypair,  // Added this!
        quoteVaultKeypair  // Added this!
      ])
      .rpc();

    console.log("Transaction signature:", tx);

    const marketAccount = await program.account.market.fetch(
      marketKeypair.publicKey
    );

    assert.equal(marketAccount.admin.toString(), payer.publicKey.toString());
    assert.equal(marketAccount.baseLotSize.toNumber(), 1000);
    assert.equal(marketAccount.quoteLotSize.toNumber(), 1000);
    // vaultSignerNonce is stored as a number/u8 in Rust, so we compare strictly
    assert.equal(marketAccount.vaultSignerNonce, vaultBump);
  });
});