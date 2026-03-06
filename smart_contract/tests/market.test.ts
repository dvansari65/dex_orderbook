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
import { Keypair } from "@solana/web3.js";

describe("orderbook - initialize_market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet;

  // Create two separate users
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

  // User token accounts
  let bidderQuoteAccount: web3.PublicKey;
  let bidderBaseAccount: web3.PublicKey;
  let askerQuoteAccount: web3.PublicKey;
  let askerBaseAccount: web3.PublicKey;

  // PDAs
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

    // Airdrop SOL to both users so they can pay for transactions
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(bidder.publicKey, 2 * web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(asker.publicKey, 2 * web3.LAMPORTS_PER_SOL)
    );

    // Create token accounts for both users
    bidderQuoteAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      quoteMint,
      bidder.publicKey
    );

    bidderBaseAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      baseMint,
      bidder.publicKey
    );

    askerQuoteAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      quoteMint,
      asker.publicKey
    );

    askerBaseAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      baseMint,
      asker.publicKey
    );

    // Mint tokens to both users
    // Bidder gets QUOTE tokens (to buy base)
    await mintTo(
      provider.connection,
      payer.payer,
      quoteMint,
      bidderQuoteAccount,
      payer.payer,
      1_200_000_000_000
    );

    // Asker gets BASE tokens (to sell for quote)
    await mintTo(
      provider.connection,
      payer.payer,
      baseMint,
      askerBaseAccount,
      payer.payer,
      600_000_000_000
    );
  });

  beforeEach(() => {
    eventQueueKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();

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

  it("should initialize market with all parameters correctly", async () => {
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

    assert.isTrue(market.baseLotSize.eq(BASE_LOT_SIZE));
    assert.isTrue(market.quoteLotSize.eq(QUOTE_LOT_SIZE));
    assert.isTrue(market.makerFeesBps.eq(MAKER_FEES_BPS));
    assert.isTrue(market.takerFeesBps.eq(TAKER_FEES_BPS));
    assert.strictEqual(market.admin.toString(), payer.publicKey.toString());
    assert.strictEqual(market.vaultSignerNonce, vaultSignerBump);
  });

  it("should initialize open orders for both users", async () => {
    // Initialize open order for bidder
    await program.methods
      .initializeOpenOrder()
      .accounts({
        openOrder: bidderOpenOrderPda,
        market: marketKeypair.publicKey,
        owner: bidder.publicKey,
        systemProgram: web3.SystemProgram.programId
      })
      .signers([bidder])
      .rpc();

    // Initialize open order for asker
    await program.methods
      .initializeOpenOrder()
      .accounts({
        openOrder: askerOpenOrderPda,
        market: marketKeypair.publicKey,
        owner: asker.publicKey,
        systemProgram: web3.SystemProgram.programId
      })
      .signers([asker])
      .rpc();

    // Verify both open orders exist
    const bidderOpenOrder = await program.account.openOrders.fetch(bidderOpenOrderPda);
    const askerOpenOrder = await program.account.openOrders.fetch(askerOpenOrderPda);

    assert.strictEqual(bidderOpenOrder.owner.toString(), bidder.publicKey.toString());
    assert.strictEqual(askerOpenOrder.owner.toString(), asker.publicKey.toString());
  });

  it("should place BID limit order by bidder", async () => {
    const base = new BN(5000000);
    const client_order_id = new BN(1);
    const price = new BN(100000000);
    const order_type = { limit: {} };
    const side = { bid: {} };

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    // Take snapshots before
    const bidderQuoteBefore = await getAccount(provider.connection, bidderQuoteAccount);
    const quoteVaultBefore = await getAccount(provider.connection, marketAccount.quoteVault);

    await program.methods
      .placeLimitOrder(base, client_order_id, price, order_type, side)
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

  });

  it("should place ASK limit order by asker", async () => {
    const base = new BN(3000000);
    const client_order_id = new BN(1);
    const price = new BN(100000000);
    const order_type = { limit: {} };
    const side = { ask: {} };

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    await program.methods
      .placeLimitOrder(base, client_order_id, price, order_type, side)
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


    const openOrderAccount = await program.account.openOrders.fetch(askerOpenOrderPda);
    const eventQueue = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    console.log("event length:", eventQueue.events.length);

    assert.equal(eventQueue.events.length, 1, "events length should be 1")
    assert.equal(eventQueue.events[0].baseQuantity.toNumber(), 3000, "filled qty must be 3000")
    assert.equal(openOrderAccount.baseLocked.toNumber(), 3000000, "base locked should be 3000");
    assert.equal(openOrderAccount.orders.length, 1, "Order count should be 1");
    assert.ok("partialFill" in eventQueue.events?.[0].eventType!);
    assert.equal(eventQueue.events?.[0].owner.toString(), asker.publicKey.toString(), `Owner should be ${asker.publicKey.toString()}`)

  });
  it("should place BID ioc order by bidder and match against existing ask", async () => {
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    // Place a fresh ask so IOC has something to match against
    await program.methods
      .placeLimitOrder(new BN(2_000_000), new BN(2), new BN(100_000_000), { limit: {} }, { ask: {} })
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

    const eventQueueBefore = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const eventsBeforeCount = eventQueueBefore.events.length; // don't hardcode, capture dynamically

    const base = new BN(2_000_000);
    const client_order_id = new BN(2);
    const price = new BN(100_000_000);
    const order_type = { immediateOrCancel: {} };
    const side = { bid: {} };

    await program.methods
      .placeIocOrder(base, price, order_type, client_order_id, side)
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: bidderOpenOrderPda,
        vaultSigner: vaultSignerPda,
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

    const eventQueueAfter = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const openOrderAccount = await program.account.openOrders.fetch(bidderOpenOrderPda);
    console.log("eventQueueAfter.events.length:", eventQueueAfter.events.length)
    assert.equal(
      eventQueueAfter.events.length,
      eventsBeforeCount,
      "IOC should push exactly 1 new Cancel event"
    );

    const iocEvent = eventQueueAfter.events[0];
    const iocEvent2 = eventQueueAfter.events[1];
    console.log("bidder public key:",bidder.publicKey.toString());
    console.log("first key:",iocEvent.owner.toString())
    console.log("second key:",iocEvent2.owner.toString())
    assert.equal(iocEvent.owner.toString(), bidder.publicKey.toString(), "IOC event owner should be bidder");
    assert.equal(iocEvent.baseQuantity.toNumber(), 2000, "IOC base quantity should be 2000 lots");
    assert.equal(iocEvent.price.toNumber(), 100_000, "IOC price should be 100000 quote lots");
  });
  it("should place BID ioc order by bidder and match against existing ask", async () => {
    const base = new BN(2_000_000); // 2000 base lots — fits within the existing ask of 3000 lots
    const client_order_id = new BN(2);
    const price = new BN(100_000_000); // same price as the ask
    const order_type = { immediateOrCancel: {} };
    const side = { bid: {} };

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);

    const eventQueueBefore = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    assert.equal(eventQueueBefore.events.length, 1, "Event queue should have 1 event before IOC");

    const bidderQuoteBefore = await getAccount(provider.connection, bidderQuoteAccount);

    await program.methods
      .placeIocOrder(base, price, order_type, client_order_id, side)
      .accounts({
        market: marketKeypair.publicKey,
        asks: asksPda,
        bids: bidsPda,
        openOrder: bidderOpenOrderPda,
        vaultSigner: vaultSignerPda,
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

    const eventQueueAfter = await program.account.eventQueue.fetch(marketAccount.eventQueue);
    const openOrderAccount = await program.account.openOrders.fetch(bidderOpenOrderPda);

    // IOC matched path pushes a Cancel event — so total events = 2
    assert.equal(eventQueueAfter.events.length, 2, "Event queue should have 2 events after IOC");

    const iocEvent = eventQueueAfter.events[1];
    assert.ok("cancel" in iocEvent.eventType, "IOC matched event type should be Cancel");
    assert.equal(
      iocEvent.owner.toString(),
      bidder.publicKey.toString(),
      `IOC event owner should be bidder`
    );
    assert.equal(
      iocEvent.baseQuantity.toNumber(),
      2000, // base_qty / base_lot_size = 2_000_000 / 1000
      "IOC event base quantity should be 2000 lots"
    );
    assert.equal(
      iocEvent.price.toNumber(),
      100000, // price_in_raw_units / quote_lot_size = 100_000_000 / 1000
      "IOC event price should match quote lots"
    );
  });
});
