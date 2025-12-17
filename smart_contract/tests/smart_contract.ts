import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { Orderbook } from "../target/types/orderbook";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("orderbook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet;
  
  // Market state - initialized once
  let marketKeypair: web3.Keypair;
  let baseMint: web3.PublicKey;
  let quoteMint: web3.PublicKey;
  let marketInfo: any;
  
  // Market PDAs - initialized once
  let bidsKeypair: web3.Keypair;
  let asksKeypair: web3.Keypair;
  let eventQueueKeypair: web3.Keypair;
  let baseVaultKeypair: web3.Keypair;
  let quoteVaultKeypair: web3.Keypair;

  // Track baseline counts after initialization
  let baselineBidsCount: number;
  let baselineAsksCount: number;

  before(async () => {
    console.log("\n=== Initializing market once before all tests ===");
    
    marketKeypair = web3.Keypair.generate();
    console.log("market key pair: ", marketKeypair.publicKey.toString());

    bidsKeypair = web3.Keypair.generate();
    asksKeypair = web3.Keypair.generate();
    eventQueueKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();

    baseMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6
    );

    quoteMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6
    );

    await program.methods
      .initialiseMarket(new BN(1000), new BN(1000), new BN(10), new BN(20))
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsKeypair.publicKey,
        asks: asksKeypair.publicKey,
        eventQueue: eventQueueKeypair.publicKey,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        baseMint: baseMint,
        quoteMint: quoteMint,
        admin: payer.publicKey,
      })
      .signers([
        marketKeypair,
        bidsKeypair,
        asksKeypair,
        eventQueueKeypair,
        baseVaultKeypair,
        quoteVaultKeypair,
      ])
      .rpc();

    marketInfo = await program.account.market.fetch(marketKeypair.publicKey);
    
    // Capture baseline counts (these are structural nodes, not orders)
    const initialBids = await program.account.slab.fetch(marketInfo.bids);
    const initialAsks = await program.account.slab.fetch(marketInfo.asks);
    baselineBidsCount = initialBids.leafCount;
    baselineAsksCount = initialAsks.leafCount;
    
    console.log("✔ Market initialized successfully!");
    console.log("Market address:", marketKeypair.publicKey.toString());
    console.log(`Baseline slab counts - Bids: ${baselineBidsCount}, Asks: ${baselineAsksCount}`);
  });

  beforeEach(async () => {
    console.log("\n--- Checking market state before test ---");
    
    try {
      const asksAccount = await program.account.slab.fetch(marketInfo.asks);
      const bidsAccount = await program.account.slab.fetch(marketInfo.bids);
      const eventAccount = await program.account.eventQueue.fetch(marketInfo.eventQueue);
      
      const actualAsks = asksAccount.leafCount - baselineAsksCount;
      const actualBids = bidsAccount.leafCount - baselineBidsCount;
      
      console.log(`Current state: ${actualAsks} actual asks, ${actualBids} actual bids, ${eventAccount.count} events`);
      
      if (actualAsks > 0) {
        console.log(`⚠️  Warning: ${actualAsks} asks exist from previous test`);
      }
      
      if (actualBids > 0) {
        console.log(`⚠️  Warning: ${actualBids} bids exist from previous test`);
      }
    } catch (error) {
      console.log("Error checking market state:", error.message);
    }
  });

  it("Initializes the market!", async () => {
    console.log("\n=== Test: Initializes the market! ===");
    console.log("Using market:", marketKeypair.publicKey.toString());

    const [vaultSigner, vaultBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    assert.equal(marketInfo.admin.toString(), payer.publicKey.toString());
    assert.equal(
      marketInfo.nextOrderId.toString(),
      "0",
      "Next order id should be 0"
    );
    assert.equal(marketInfo.baseLotSize.toNumber(), 1000);
    assert.equal(marketInfo.quoteLotSize.toNumber(), 1000);
    assert.equal(marketInfo.vaultSignerNonce, vaultBump);
    
    console.log("✔ Market initialization verified!");
  });

  it("should place ask order", async () => {
    console.log("\n=== Test: should place ask order ===");
    console.log("Using market:", marketKeypair.publicKey.toString());

    const user = web3.Keypair.generate();
    
    const airdropSig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const userQuoteTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      quoteMint,
      user.publicKey
    );
    const userBaseTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      baseMint,
      user.publicKey
    );

    await mintTo(
      provider.connection,
      user,
      quoteMint,
      userQuoteTokenAccount,
      payer.payer,
      100_000_000
    );
    await mintTo(
      provider.connection,
      user,
      baseMint,
      userBaseTokenAccount,
      payer.payer,
      100_000_000
    );

    const [openOrderPda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("open_order"),
        marketKeypair.publicKey.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      program.programId
    );
    
    // Get state before placing order
    const bidsBeforeAsk = await program.account.slab.fetch(marketInfo.bids);
    const asksBeforeAsk = await program.account.slab.fetch(marketInfo.asks);
    
    await program.methods
      .initializeOpenOrder()
      .accounts({
        owner: user.publicKey,
        market: marketKeypair.publicKey,
      })
      .signers([user])
      .rpc();

    await program.methods
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
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const openOrderAccount = await program.account.openOrders.fetch(openOrderPda);
    const asksAfter = await program.account.slab.fetch(marketInfo.asks);
    const bidsAfter = await program.account.slab.fetch(marketInfo.bids);
    const eventAccount = await program.account.eventQueue.fetch(marketInfo.eventQueue);

    // Calculate actual new orders placed
    const newAsks = asksAfter.leafCount - asksBeforeAsk.leafCount;
    const newBids = bidsAfter.leafCount - bidsBeforeAsk.leafCount;

    console.log(`Orders placed - New asks: ${newAsks}, New bids: ${newBids}`);
    console.log(`Total leaf counts - Asks: ${asksAfter.leafCount}, Bids: ${bidsAfter.leafCount}`);

    // Verify only ask was added, no bids
    assert.equal(newAsks, 1, "Should have added exactly 1 ask order");
    assert.equal(newBids, 0, "Should not have added any bid orders");
    
    assert.equal(openOrderAccount.baseLocked.toString(), "1000000");
    assert.equal(openOrderAccount.quoteLocked.toString(), "0");
    assert.equal(
      Number(eventAccount.count),
      1,
      "Event queue should have 1 event"
    );
    
    console.log("✔ Ask order placed successfully!");
  });

  it("should place bid order", async () => {
    console.log("\n=== Test: should place bid order ===");
    console.log("Using market:", marketKeypair.publicKey.toString());
    
    const bidUser = web3.Keypair.generate();

    const airdropSig = await provider.connection.requestAirdrop(
      bidUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const userQuoteTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      bidUser,
      quoteMint,
      bidUser.publicKey
    );

    const userBaseTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      bidUser,
      baseMint,
      bidUser.publicKey
    );

    await mintTo(
      provider.connection,
      bidUser,
      quoteMint,
      userQuoteTokenAccount,
      payer.payer,
      1_000_000_000
    );

    await mintTo(
      provider.connection,
      bidUser,
      baseMint,
      userBaseTokenAccount,
      payer.payer,
      1_000_000_000
    );

    const [openOrderPda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("open_order"),
        marketKeypair.publicKey.toBuffer(),
        bidUser.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Capture state before placing bid
    const bidsBeforeBid = await program.account.slab.fetch(marketInfo.bids);
    const asksBeforeBid = await program.account.slab.fetch(marketInfo.asks);

    await program.methods
      .initializeOpenOrder()
      .accounts({
        owner: bidUser.publicKey,
        market: marketKeypair.publicKey,
      })
      .signers([bidUser])
      .rpc();

    const maxBaseQty = new BN(5_000_000);
    const clientOrderId = new BN(23230);
    const price = new BN(100);

    await program.methods
      .placeOrder(maxBaseQty, clientOrderId, price, { limit: {} }, { bid: {} })
      .accounts({
        owner: bidUser.publicKey,
        asks: marketInfo.asks,
        bids: marketInfo.bids,
        quoteVault: marketInfo.quoteVault,
        baseVault: marketInfo.baseVault,
        eventQueue: marketInfo.eventQueue,
        userBaseVault: userBaseTokenAccount,
        userQuoteVault: userQuoteTokenAccount,
        market: marketKeypair.publicKey,
        openOrder: openOrderPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bidUser])
      .rpc();

    const openOrderAccount = await program.account.openOrders.fetch(openOrderPda);
    const bidsAfter = await program.account.slab.fetch(marketInfo.bids);
    const asksAfter = await program.account.slab.fetch(marketInfo.asks);
    const eventAccount = await program.account.eventQueue.fetch(marketInfo.eventQueue);

    // Calculate actual new orders
    const newBids = bidsAfter.leafCount - bidsBeforeBid.leafCount;
    const newAsks = asksAfter.leafCount - asksBeforeBid.leafCount;

    console.log(`Orders placed - New bids: ${newBids}, New asks: ${newAsks}`);
    console.log(`Total leaf counts - Bids: ${bidsAfter.leafCount}, Asks: ${asksAfter.leafCount}`);

    // Verify only bid was added
    assert.equal(newBids, 1, "Should have added exactly 1 bid order");
    assert.equal(newAsks, 0, "Should not have added any ask orders");

    const expectedQuoteLocked = maxBaseQty
      .div(marketInfo.baseLotSize)
      .mul(price)
      .mul(marketInfo.quoteLotSize);

    assert.equal(
      openOrderAccount.baseLocked.toString(),
      "0",
      "Base locked should be 0 for bid orders"
    );

    assert.equal(
      openOrderAccount.quoteLocked.toString(),
      expectedQuoteLocked.toString(),
      "Quote locked should match calculation"
    );

    // Find the most recent new order event
    const eventCount = Number(eventAccount.count);
    let lastNewOrderEvent = null;
    for (let i = eventCount - 1; i >= 0; i--) {
      if (eventAccount.events[i].eventType.newOrder !== undefined) {
        lastNewOrderEvent = eventAccount.events[i];
        break;
      }
    }

    assert.isNotNull(lastNewOrderEvent, "Should have a NewOrder event");
    
    if (lastNewOrderEvent) {
      assert.equal(
        Number(lastNewOrderEvent.price),
        100,
        "Event price should be 100"
      );

      assert.equal(
        lastNewOrderEvent.maker.toString(),
        bidUser.publicKey.toString(),
        "Event maker should be bidUser"
      );
    }

    assert.equal(
      openOrderAccount.orders.length,
      1,
      "Open orders should have 1 order"
    );

    const expectedQuantity = maxBaseQty.div(marketInfo.baseLotSize).toNumber();

    assert.equal(
      Number(openOrderAccount.orders[0].quantity),
      expectedQuantity,
      "Order quantity should be 5000"
    );

    assert.equal(
      Number(openOrderAccount.orders[0].price),
      100,
      "Order price should be 100"
    );

    assert.equal(
      Number(openOrderAccount.orders[0].clientOrderId),
      23230,
      "Client order ID should be 23230"
    );

    assert.equal(
      openOrderAccount.orders[0].side.bid !== undefined,
      true,
      "Order side should be Bid"
    );
    
    console.log("✔ Bid order placed successfully!");
  });

  after(async () => {
    console.log("\n=== Test suite completed ===");
    console.log("All tests used the same market:", marketKeypair.publicKey.toString());
    
    try {
      const finalMarketInfo = await program.account.market.fetch(marketKeypair.publicKey);
      const finalAsks = await program.account.slab.fetch(marketInfo.asks);
      const finalBids = await program.account.slab.fetch(marketInfo.bids);
      
      const actualAsks = finalAsks.leafCount - baselineAsksCount;
      const actualBids = finalBids.leafCount - baselineBidsCount;
      
      console.log("Final market state:");
      console.log(`- Actual asks placed: ${actualAsks}`);
      console.log(`- Actual bids placed: ${actualBids}`);
      console.log(`- Total leaf counts (includes structure): Asks ${finalAsks.leafCount}, Bids ${finalBids.leafCount}`);
      console.log("- Next Order ID:", finalMarketInfo.nextOrderId.toString());
    } catch (error) {
      console.log("Could not fetch final market state:", error.message);
    }
  });
});