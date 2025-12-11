import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { Orderbook } from "../target/types/orderbook";
import { 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccount, 
  createMint, // Import this to actually create mints
  mintTo
} from "@solana/spl-token";
import { assert } from "chai";

describe("orderbook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet; // Explicit cast for TS
  const marketKeypair = web3.Keypair.generate();
  let baseMint;
  let quoteMint;
  it("Initializes the market!", async () => {
    // 1️⃣ Generate Keypairs for all accounts we are initializing
    
    const bidsKeypair = web3.Keypair.generate();
    const asksKeypair = web3.Keypair.generate();
    const eventQueueKeypair = web3.Keypair.generate();
    console.log("marketKeypair",marketKeypair.publicKey.toString())
    // Keypairs for the Vaults (Must be Keypairs, not just PublicKeys)
    const baseVaultKeypair = web3.Keypair.generate();
    const quoteVaultKeypair = web3.Keypair.generate();

    // 2️⃣ Create ACTUAL Token Mints on-chain
    // We cannot just generate a keypair, we must ask the Token Program to create the mint account
     baseMint = await createMint(
      provider.connection,
      payer.payer, // The actual Keypair of the wallet
      payer.publicKey, // Mint authority
      null, // Freeze authority
      6 // Decimals
    );

     quoteMint = await createMint(
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
    console.log("market account",marketAccount)
    assert.equal(marketAccount.admin.toString(), payer.publicKey.toString());
    assert.equal(marketAccount.baseLotSize.toNumber(), 1000);
    assert.equal(marketAccount.quoteLotSize.toNumber(), 1000);
    // vaultSignerNonce is stored as a number/u8 in Rust, so we compare strictly
    assert.equal(marketAccount.vaultSignerNonce, vaultBump);
  });

  it("should place the order",async ()=>{
    const marketInfo = await program.account.market.fetch(marketKeypair.publicKey);
    const user = web3.Keypair.generate();
    // airdrop sol to user
    const airdropSig = await provider.connection.requestAirdrop(user.publicKey,2*anchor.web3.LAMPORTS_PER_SOL)
    await provider.connection.confirmTransaction(airdropSig);
    const userQuoteTokenAccount = await createAssociatedTokenAccount(provider.connection,user,quoteMint,user.publicKey)
    const userBaseTokenAccount = await createAssociatedTokenAccount(provider.connection,user,baseMint,user.publicKey)
    await mintTo(provider.connection,user,quoteMint,userQuoteTokenAccount,payer.payer,100_000_000)
    await mintTo(provider.connection,user,baseMint,userBaseTokenAccount,payer.payer,100_000_000)
    const [openOrderPda] =  web3.PublicKey.findProgramAddressSync(
      [
       Buffer.from("open_order"),
       marketKeypair.publicKey.toBuffer(),
       user.publicKey.toBuffer()
      ],
      program.programId
    )
    // const openOrderAccount = await program.account.openOrders.fetch(openOrderPda)
   const openOrder = await program.methods 
                .initializeOpenOrder()
                .accounts({
                  owner:user.publicKey,
                  market:marketKeypair.publicKey,
                })
                .signers([user])
                .rpc()
    const placeOrderTx = await program.methods    
                .placeOrder(
                  new BN(1_000_000),
                  new BN(23239),
                  new BN(110),
                  {limit:{}},
                  {ask:{}}
                )
                .accounts({
                  owner:user.publicKey,
                  asks:marketInfo.asks,
                  bids:marketInfo.bids,
                  quoteVault:marketInfo.quoteVault,
                  baseVault:marketInfo.baseVault,
                  eventQueue:marketInfo.eventQueue,
                  userBaseVault:userBaseTokenAccount,
                  userQuoteVault:userQuoteTokenAccount,
                  market:marketKeypair.publicKey,
                  openOrder:openOrderPda,
                  tokenProgram:TOKEN_PROGRAM_ID
                })
                .signers([user])
                .rpc()
    const openOrderAccount = await program.account.openOrders.fetch(openOrderPda)
    const asksAccount = await program.account.slab.fetch(marketInfo.asks);
    console.log("Sell order placed:", {
      baseLocked: openOrderAccount.baseLocked.toString(),
      asksCount: asksAccount.leafCount
    });
    assert.equal(openOrderAccount.baseLocked.toString(), "1000000");
  })
});