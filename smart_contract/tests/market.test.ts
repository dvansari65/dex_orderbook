import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { Orderbook } from "../target/types/orderbook";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

describe("orderbook - initialize_market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet;

  const bidder = Keypair.generate();
  const asker = Keypair.generate();

  const BASE_LOT_SIZE = new BN(1000);
  const QUOTE_LOT_SIZE = new BN(1000);
  const MAKER_FEES_BPS = new BN(10);
  const TAKER_FEES_BPS = new BN(20);

  let marketKeypair: web3.Keypair;
  let baseMint: web3.PublicKey;
  let quoteMint: web3.PublicKey;
  let eventQueueKeypair: web3.Keypair;
  let baseVaultKeypair: web3.Keypair;
  let quoteVaultKeypair: web3.Keypair;

  let bidderQuoteAccount: web3.PublicKey;
  let bidderBaseAccount: web3.PublicKey;
  let askerQuoteAccount: web3.PublicKey;
  let askerBaseAccount: web3.PublicKey;

  let bidsPda: web3.PublicKey;
  let asksPda: web3.PublicKey;
  let vaultSignerPda: web3.PublicKey;
  let vaultSignerBump: number;
  let bidderOpenOrderPda: web3.PublicKey;
  let askerOpenOrderPda: web3.PublicKey;

  before(async () => {
    marketKeypair = web3.Keypair.generate();
    baseMint = await createMint(provider.connection, payer.payer, payer.publicKey, null, 6);
    quoteMint = await createMint(provider.connection, payer.payer, payer.publicKey, null, 6);

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(bidder.publicKey, 2 * web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(asker.publicKey, 2 * web3.LAMPORTS_PER_SOL)
    );

    bidderQuoteAccount = await createAssociatedTokenAccount(
      provider.connection, payer.payer, quoteMint, bidder.publicKey
    );
    bidderBaseAccount = await createAssociatedTokenAccount(
      provider.connection, payer.payer, baseMint, bidder.publicKey
    );
    askerQuoteAccount = await createAssociatedTokenAccount(
      provider.connection, payer.payer, quoteMint, asker.publicKey
    );
    askerBaseAccount = await createAssociatedTokenAccount(
      provider.connection, payer.payer, baseMint, asker.publicKey
    );

    // Bidder gets QUOTE tokens (to buy base)
    await mintTo(provider.connection, payer.payer, quoteMint, bidderQuoteAccount, payer.payer, 1_200_000_000_000);
    // Asker gets BASE tokens (to sell for quote)
    await mintTo(provider.connection, payer.payer, baseMint, askerBaseAccount, payer.payer, 600_000_000_000);

    [bidsPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bids"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
    [asksPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("asks"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
    [vaultSignerPda, vaultSignerBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
    [bidderOpenOrderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("open_order"), marketKeypair.publicKey.toBuffer(), bidder.publicKey.toBuffer()],
      program.programId
    );
    [askerOpenOrderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("open_order"), marketKeypair.publicKey.toBuffer(), asker.publicKey.toBuffer()],
      program.programId
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Test 1: Initialize market
  // ─────────────────────────────────────────────────────────────
  it("should initialize market with all parameters correctly", async () => {
    eventQueueKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();

    await program.methods
      .initialiseMarket(BASE_LOT_SIZE, QUOTE_LOT_SIZE, MAKER_FEES_BPS, TAKER_FEES_BPS)
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsPda,
        asks: asksPda,
        eventQueue: eventQueueKeypair.publicKey,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        vaultSigner: vaultSignerPda,
        baseMint,
        quoteMint,
        admin: payer.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([marketKeypair, eventQueueKeypair, baseVaultKeypair, quoteVaultKeypair, payer.payer])
      .rpc();

    const market = await program.account.market.fetch(marketKeypair.publicKey);
    console.log("market key:",marketKeypair.publicKey.toString());
    console.log("base mint:",baseMint.toString());
    console.log("quote mint:",quoteMint.toString())
    assert.isTrue(market.baseLotSize.eq(BASE_LOT_SIZE));
    assert.isTrue(market.quoteLotSize.eq(QUOTE_LOT_SIZE));
    assert.isTrue(market.makerFeesBps.eq(MAKER_FEES_BPS));
    assert.isTrue(market.takerFeesBps.eq(TAKER_FEES_BPS));
    assert.strictEqual(market.admin.toString(), payer.publicKey.toString());
    assert.strictEqual(market.vaultSignerNonce, vaultSignerBump);
  });

  // ─────────────────────────────────────────────────────────────
  // Test 2: Initialize open orders
  // ─────────────────────────────────────────────────────────────
  it("should initialize open orders for both users", async () => {
    await program.methods
      .initializeOpenOrder()
      .accounts({
        openOrder: bidderOpenOrderPda,
        market: marketKeypair.publicKey,
        owner: bidder.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();

    await program.methods
      .initializeOpenOrder()
      .accounts({
        openOrder: askerOpenOrderPda,
        market: marketKeypair.publicKey,
        owner: asker.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([asker])
      .rpc();

    const bidderOpenOrder = await program.account.openOrders.fetch(bidderOpenOrderPda);
    const askerOpenOrder = await program.account.openOrders.fetch(askerOpenOrderPda);

    assert.strictEqual(bidderOpenOrder.owner.toString(), bidder.publicKey.toString());
    assert.strictEqual(askerOpenOrder.owner.toString(), asker.publicKey.toString());
  });

  // ─────────────────────────────────────────────────────────────
  // Test 3: BID limit order — no cross (book is empty)
  // Events after: 1 (Place)
  // State: bids has 5000 lots @ 100000 quote lots
  // ─────────────────────────────────────────────────────────────
  it("should place BID limit order by bidder", async () => {
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    const bidderQuoteBefore = await getAccount(provider.connection, bidderQuoteAccount);
    const quoteVaultBefore = await getAccount(provider.connection, marketAccount.quoteVault);

    // 5000000 base raw / 1000 base_lot_size = 5000 base lots
    // 100000000 price raw / 1000 quote_lot_size = 100000 quote lots
    // quote locked = 100000 * 5000 * 1000 = 500_000_000_000
    await program.methods
      .placeLimitOrder(
        new BN(5_000_000),  // max_base_size
        new BN(1),          // client_order_id
        new BN(100_000_000),// price
        { limit: {} },
        { bid: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: bidderOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        owner: bidder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      // No remainingAccounts — book is empty, no fills
      .signers([bidder])
      .rpc();

    const marketAccountAfter = await program.account.market.fetch(marketKeypair.publicKey);
    const eventQueue = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const bidderOpenOrder = await program.account.openOrders.fetch(bidderOpenOrderPda);
    const quoteVaultAfter = await getAccount(provider.connection, marketAccount.quoteVault);

    // 1 Place event
    assert.equal(eventQueue.events.length, 1, "Should have 1 event (Place)");
    assert.ok("place" in eventQueue.events[0].eventType, "Event should be Place");
    assert.equal(eventQueue.events[0].baseQuantity.toNumber(), 5000, "Base quantity should be 5000 lots");
    assert.equal(eventQueue.events[0].owner.toString(), bidder.publicKey.toString());

    // Quote locked = 100000 * 5000 * 1000 = 500_000_000_000
    assert.equal(bidderOpenOrder.quoteLocked.toNumber(), 500_000_000_000);
    assert.equal(bidderOpenOrder.orders.length, 1, "Should have 1 resting order");

    // Tokens moved from bidder to vault
    const bidderQuoteAfter = await getAccount(provider.connection, bidderQuoteAccount);
    assert.equal(
      Number(bidderQuoteAfter.amount),
      Number(bidderQuoteBefore.amount) - 500_000_000_000,
      "Bidder quote should be debited"
    );
    assert.equal(
      Number(quoteVaultAfter.amount),
      Number(quoteVaultBefore.amount) + 500_000_000_000,
      "Quote vault should be credited"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Test 4: ASK limit order — crosses existing BID (5000 lots)
  // ASK is 3000 lots — fully fills, BID has 2000 remaining
  // Events after: 3 (Place BID, Place ASK, Fill)
  // remainingAccounts: bidderOpenOrderPda (maker)
  // ─────────────────────────────────────────────────────────────
  it("should place ASK limit order by asker and fill against BID", async () => {
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    const eventQueueBefore = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const countBefore = eventQueueBefore.events.length; // 1 from BID Place

    await program.methods
      .placeLimitOrder(
        new BN(3_000_000),   // max_base_size — 3000 lots
        new BN(1),           // client_order_id
        new BN(100_000_000), // price — same as BID, will cross
        { limit: {} },
        { ask: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: askerOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: askerBaseAccount,
        userQuoteVault: askerQuoteAccount,
        owner: asker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([asker])
      .rpc();

    const eventQueue = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const askerOpenOrder = await program.account.openOrders.fetch(askerOpenOrderPda);
    const bidderOpenOrder = await program.account.openOrders.fetch(bidderOpenOrderPda);

    // Place ASK + Fill = 2 new events
    assert.equal(eventQueue.events.length, countBefore + 2, "Should have 2 new events (Place + Fill)");

    // Place event came first
    assert.ok("place" in eventQueue.events[countBefore].eventType, "First new event should be Place");
    assert.equal(eventQueue.events[countBefore].owner.toString(), asker.publicKey.toString());
    assert.equal(eventQueue.events[countBefore].baseQuantity.toNumber(), 3000);

    // Fill event second
    console.log("event:",eventQueue.events[countBefore + 1].eventType)
    assert.ok("partialFill" in eventQueue.events[countBefore + 1].eventType, "Second new event should be Fill");
    assert.equal(eventQueue.events[countBefore + 1].baseQuantity.toNumber(), 3000);

    // ASK fully filled — asker.base_locked = 0, asker.quote_free credited
    assert.equal(askerOpenOrder.baseLocked.toNumber(), 3000_000, "Asker base locked should be 0 after full fill");
    assert.equal(askerOpenOrder.quoteFree.toNumber(), 0, "Asker quote_free = 3000 * 100000 * 1000");

    // BID partial fill — bidder.base_free credited for 3000 lots
    assert.equal(bidderOpenOrder.baseFree.toNumber(), 0, "Bidder base_free = 3000 * 1000");
    // BID quote_locked reduced by 3000 lots worth
    assert.equal(bidderOpenOrder.quoteLocked.toNumber(),500000000000, "Bidder quote_locked = 2000 * 100000 * 1000 remaining");
      console.log("askerOpenOrder.orders.length:",askerOpenOrder.orders.length)
    // ASK order fully filled — should not be in resting orders
    assert.equal(askerOpenOrder.orders.length, 0, "Asker should have no resting orders");
  });

  // ─────────────────────────────────────────────────────────────
  // Test 5: IOC BID — matches against remaining ASK in book
  // Before this test: BID has 2000 lots remaining resting
  // Place fresh ASK 2000 lots → crosses BID → fill
  // Then IOC BID 2000 lots → no asks left → cancel
  // ─────────────────────────────────────────────────────────────
  it("should place IOC BID and cancel when no asks available", async () => {
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    // Place fresh ASK 2000 lots — crosses remaining BID of 2000 lots
    await program.methods
      .placeLimitOrder(
        new BN(2_000_000),
        new BN(2),
        new BN(100_000_000),
        { limit: {} },
        { ask: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: askerOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: askerBaseAccount,
        userQuoteVault: askerQuoteAccount,
        owner: asker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([asker])
      .rpc();

    const eventQueueMid = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const countMid = eventQueueMid.events.length;

    // Now place IOC BID — book should be empty (all bids consumed), expect cancel
    await program.methods
      .placeIocOrder(
        new BN(2_000_000),   // base_qty
        new BN(100_000_000), // price
        { immediateOrCancel: {} },
        new BN(3),           // client_order_id
        { bid: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: bidderOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        owner: bidder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      // No remainingAccounts — no fill expected
      .signers([bidder])
      .rpc();

    const eventQueueAfter = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const bidderOpenOrder = await program.account.openOrders.fetch(bidderOpenOrderPda);

    // IOC no-fill path: Place + Cancel = 2 new events
    assert.equal(
      eventQueueAfter.events.length,
      countMid + 2,
      "IOC cancel path should push 2 events (Place + Cancel)"
    );

    const placeEvent = eventQueueAfter.events[countMid];
    const cancelEvent = eventQueueAfter.events[countMid + 1];

    assert.ok("place" in placeEvent.eventType, "First IOC event should be Place");
    assert.ok("cancel" in cancelEvent.eventType, "Second IOC event should be Cancel");
    assert.equal(cancelEvent.owner.toString(), bidder.publicKey.toString());
    assert.equal(cancelEvent.baseQuantity.toNumber(), 2000, "Cancel base qty should be 2000 lots");
    assert.equal(cancelEvent.price.toNumber(), 100000, "Cancel price should be 100000 quote lots");

  });

  // ─────────────────────────────────────────────────────────────
  // Test 6: IOC BID — matches against fresh ASK
  // Place fresh ASK 2000 lots first, then IOC BID 2000 lots fills it
  // ─────────────────────────────────────────────────────────────
  it("should place IOC BID and fill against existing ASK", async () => {
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    // ── Snapshots BEFORE placing fresh ASK ──
    const quoteVaultBefore = await getAccount(provider.connection, marketAccount.quoteVault);
    const baseVaultBefore  = await getAccount(provider.connection, marketAccount.baseVault);
    const marketBefore     = await program.account.market.fetch(marketKeypair.publicKey);

    // ── Place fresh ASK 2000 lots — book is empty so no cross ──
    await program.methods
      .placeLimitOrder(
        new BN(2_000_000),
        new BN(3),
        new BN(100_000_000),
        { limit: {} },
        { ask: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: askerOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: askerBaseAccount,
        userQuoteVault: askerQuoteAccount,
        owner: asker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      // No remainingAccounts — no bids left to cross
      .signers([asker])
      .rpc();

    // Capture asker's resting order ID BEFORE IOC clears it
    // Used to verify makerOrderId in fill event
    const askerOpenOrderMid = await program.account.openOrders.fetch(askerOpenOrderPda);
    const makerOrderId = askerOpenOrderMid.orders[0].orderId;

    assert.equal(askerOpenOrderMid.orders.length, 1, "Asker should have 1 resting order before IOC");
    assert.equal(askerOpenOrderMid.baseLocked.toNumber(), 7_000_000, "Asker base locked should be 2_000_000 after placing ASK");

    const eventQueueMid  = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const countMid       = eventQueueMid.events.length;
    const bidderOpenOrderMid = await program.account.openOrders.fetch(bidderOpenOrderPda);

    // ── Place IOC BID — fills against fresh ASK ──
    await program.methods
      .placeIocOrder(
        new BN(2_000_000),
        new BN(100_000_000),
        { immediateOrCancel: {} },
        new BN(4),
        { bid: {} }
      )
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: bidderOpenOrderPda,
        eventQueue: marketAccount.eventQueue,
        quoteVault: marketAccount.quoteVault,
        baseVault: marketAccount.baseVault,
        userBaseVault: bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        owner: bidder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bidder])
      .rpc();

    // ── Fetch all state after IOC ──
    const eventQueueAfter    = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const bidderOpenOrder    = await program.account.openOrders.fetch(bidderOpenOrderPda);
    const askerOpenOrder     = await program.account.openOrders.fetch(askerOpenOrderPda);
    const marketAfter        = await program.account.market.fetch(marketKeypair.publicKey);
    const quoteVaultAfter    = await getAccount(provider.connection, marketAccount.quoteVault);
    const baseVaultAfter     = await getAccount(provider.connection, marketAccount.baseVault);

    // ── 1. Event count ──
    // IOC fill path: Place + Fill + Cancel = 3 new events
    assert.equal(
      eventQueueAfter.events.length,
      countMid + 3,
      "IOC fill path should push 3 events (Place + Fill + Cancel)"
    );

    const placeEvent  = eventQueueAfter.events[countMid];
    const fillEvent   = eventQueueAfter.events[countMid + 1];
    const cancelEvent = eventQueueAfter.events[countMid + 2];

    // ── 2. Place event ──
    assert.ok("place" in placeEvent.eventType, "First event should be Place");
    assert.equal(placeEvent.owner.toString(), bidder.publicKey.toString(), "Place owner should be bidder");
    assert.equal(placeEvent.baseQuantity.toNumber(), 2000, "Place base qty should be 2000 lots");
    assert.equal(placeEvent.price.toNumber(), 100000, "Place price should be 100000 quote lots");
    assert.equal(placeEvent.clientOrderId.toNumber(), 4, "Place client order id should be 4");

    // ── 3. Fill event ──
    assert.ok("fill" in fillEvent.eventType, "Second event should be Fill");
    assert.equal(fillEvent.baseQuantity.toNumber(), 2000, "Fill qty should be 2000 lots");
    assert.equal(fillEvent.price.toNumber(), 100000, "Fill price should be 100000 quote lots");
    assert.equal(fillEvent.owner.toString(), bidder.publicKey.toString(), "Taker should be bidder");
    assert.equal(fillEvent.counterparty.toString(), asker.publicKey.toString(), "Maker should be asker");
    assert.equal(
      fillEvent.makerOrderId.toNumber(),
      makerOrderId.toNumber(),
      "Fill event makerOrderId should match asker resting order id"
    );

    // ── 4. Cancel event ──
    // IOC fully filled — order.quantity = 0 at cancel time
    assert.ok("cancel" in cancelEvent.eventType, "Third event should be Cancel");
    assert.equal(cancelEvent.owner.toString(), bidder.publicKey.toString(), "Cancel owner should be bidder");
    assert.equal(cancelEvent.baseQuantity.toNumber(), 2000, "Cancel base qty = 0 because fully filled");
    assert.equal(cancelEvent.price.toNumber(), 100000, "Cancel price should be 100000 quote lots");

    // ── 5. global_seq incremented by 3 (Place + Fill + Cancel) ──
    assert.equal(
      marketAfter.globalSeq.toNumber(),
      marketBefore.globalSeq.toNumber() + 4, // +1 for ASK Place + 3 for IOC (Place+Fill+Cancel)
      "global_seq should increment by 4 total (1 ASK place + 3 IOC events)"
    );

    // ── 6. Bidder settlement ──
    // Bidder bought base — base_free increases, quote_locked decreases to 0
    assert.equal(
      bidderOpenOrder.baseFree.toNumber(),
      0, // accumulated: 3_000_000 (test4) + 2_000_000 (test5) + 2_000_000 (this test)
      "Bidder base_free accumulated across all fill tests"
    );
    assert.equal(
      bidderOpenOrder.quoteLocked.toNumber(),
      900000000000,
      "Bidder quote_locked should be 0 — fully consumed by fill"
    );
    assert.equal(
      bidderOpenOrder.quoteFree.toNumber(),
      bidderOpenOrderMid.quoteFree.toNumber(),
      "Bidder quote_free should not change — bidder was buying not selling"
    );

    // ── 7. Asker settlement ──
    // Asker sold base — quote_free increases, base_locked decreases to 0
    assert.equal(
      askerOpenOrder.quoteFree.toNumber(),
      0, // accumulated: 300B (test4) + 200B (test5) + 200B (this test)
      "Asker quote free should be zero!"
    );
    assert.equal(
      askerOpenOrder.baseLocked.toNumber(),
      7000000,
      "Asker base_locked should be 0 — fully consumed by fill"
    );
    assert.equal(
      askerOpenOrder.baseFree.toNumber(),
      0,
      "Asker base_free should be 0 — asker sold base, never received base"
    );

    // ── 8. Asker resting orders cleared ──
    assert.equal(
      askerOpenOrder.orders.length,
      1,
      "Asker should have no resting orders after full fill"
    );
  });
  it("should consume events:",async ()=>{
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    const eventQueue = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    console.log("events:",eventQueue.events)
    console.log("length:",eventQueue.events.length)
    let vaultSigner = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_signer"),
        marketKeypair.publicKey.toBuffer()
      ],
      program.programId
    )
    const tx = await  program.methods
                  .consumeEvents(10)
                  .accounts({
                    market:marketKeypair.publicKey,
                    eventQueue:marketAccount.eventQueue,
                    baseVault:marketAccount.baseVault,
                    quoteVault:marketAccount.quoteVault,
                    vaultSigner,
                    crank:payer.publicKey,
                    tokenProgram:TOKEN_PROGRAM_ID
                  })
                  .rpc()
    console.log("tx:",tx)
  })
});