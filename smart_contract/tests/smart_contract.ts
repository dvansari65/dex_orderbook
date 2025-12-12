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
  let marketKeypair;
  let baseMint;
  let quoteMint;
  let marketInfo;
  beforeEach(async () => {

    marketKeypair = web3.Keypair.generate();
    const bidsKeypair = web3.Keypair.generate();
    const asksKeypair = web3.Keypair.generate();
    const eventQueueKeypair = web3.Keypair.generate();
    console.log("marketKeypair", marketKeypair.publicKey.toString())
    const baseVaultKeypair = web3.Keypair.generate();
    const quoteVaultKeypair = web3.Keypair.generate();

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

    marketInfo = await program.account.market.fetch(
      marketKeypair.publicKey
    );

  })

  it("Initializes the market!", async () => {
    const [vaultSigner, vaultBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
    // 1️⃣ Generate Keypairs for all accounts we are initializing
    assert.equal(marketInfo.admin.toString(), payer.publicKey.toString());
    assert.equal(marketInfo.baseLotSize.toNumber(), 1000);
    assert.equal(marketInfo.quoteLotSize.toNumber(), 1000);
    // vaultSignerNonce is stored as a number/u8 in Rust, so we compare strictly
    assert.equal(marketInfo.vaultSignerNonce, vaultBump);
  });

  it("should place the order", async () => {
    const marketInfo = await program.account.market.fetch(marketKeypair.publicKey);
    const user = web3.Keypair.generate();
    // airdrop sol to user
    const airdropSig = await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    await provider.connection.confirmTransaction(airdropSig); // confirm transaction

    const userQuoteTokenAccount = await createAssociatedTokenAccount(provider.connection, user, quoteMint, user.publicKey)
    const userBaseTokenAccount = await createAssociatedTokenAccount(provider.connection, user, baseMint, user.publicKey)
    await mintTo(provider.connection, user, quoteMint, userQuoteTokenAccount, payer.payer, 100_000_000)
    await mintTo(provider.connection, user, baseMint, userBaseTokenAccount, payer.payer, 100_000_000)
    const [openOrderPda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("open_order"),
        marketKeypair.publicKey.toBuffer(),
        user.publicKey.toBuffer()
      ],
      program.programId
    )
    const baseLots = 1_000_000 / Number(marketInfo.baseLotSize);
    // const openOrderAccount = await program.account.openOrders.fetch(openOrderPda)
    const openOrder = await program.methods
      .initializeOpenOrder()
      .accounts({
        owner: user.publicKey,
        market: marketKeypair.publicKey,
      })
      .signers([user])
      .rpc()
    const placeOrderTx = await program.methods
      .placeOrder(
        new BN(1_000_000),
        new BN(23239),
        new BN(110),
        { limit: {} },
        { ask: {} }
      )
      .accounts({
        owner: user.publicKey,
        asks: marketInfo.asks,
        bids: marketInfo.bids,
        quoteVault: marketInfo.quoteVault,
        baseVault: marketInfo.baseVault,
        eventQueue: marketInfo.eventQueue,
        userBaseVault: userBaseTokenAccount,
        userQuoteVault: userQuoteTokenAccount,
        market: marketKeypair.publicKey,
        openOrder: openOrderPda,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .signers([user])
      .rpc()

    const openOrderAccount = await program.account.openOrders.fetch(openOrderPda)
    const asksAccount = await program.account.slab.fetch(marketInfo.asks);
    const eventAccount = await program.account.eventQueue.fetch(marketInfo.eventQueue)
    
    // Assert base_locked amount (for Ask side)
    assert.equal(openOrderAccount.baseLocked.toString(), "1000000");

    // Assert quote_locked should be 0 for Ask orders
    assert.equal(openOrderAccount.quoteLocked.toString(), "0");

    // Assert the order was added to the asks slab
    assert.equal(asksAccount.leafCount, 1, "Asks slab should have 1 order");

    // Assert event queue count
    assert.equal(Number(eventAccount.count), 1, "Event queue should have 1 event");

    // Assert event type is NewOrder (0)
    assert.equal(eventAccount.events[0].eventType.newOrder !== undefined, true, "Event should be NewOrder type");

    // Assert event price
    assert.equal(Number(eventAccount.events[0].price), 110, "Event price should match order price");

    // Assert event quantity (base_lots)
    assert.equal(Number(eventAccount.events[0].quantity), baseLots, "Event quantity should match base lots");

    // Assert event maker
    assert.equal(eventAccount.events[0].maker.toString(), user.publicKey.toString(), "Event maker should be the user");

    // Assert open orders array has the order
    assert.equal(openOrderAccount.orders.length, 1, "Open orders should have 1 order");

    // Assert order details in open orders
    assert.equal(Number(openOrderAccount.orders[0].quantity), baseLots, "Order quantity should match base lots");
    assert.equal(Number(openOrderAccount.orders[0].price), 110, "Order price should be 110");
    assert.equal(Number(openOrderAccount.orders[0].clientOrderId), 23239, "Client order ID should match");
    assert.equal(openOrderAccount.orders[0].side.ask !== undefined, true, "Order side should be Ask");

  })
});