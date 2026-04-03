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

  const bidder = Keypair.generate();
  const asker = Keypair.generate();

  const BASE_LOT_SIZE = new BN(1000);
  const QUOTE_LOT_SIZE = new BN(1000);
  const MAKER_FEES_BPS = new BN(10);
  const TAKER_FEES_BPS = new BN(20);

  let marketKeypair: web3.Keypair;
  let baseVaultKeypair: web3.Keypair;
  let quoteVaultKeypair: web3.Keypair;

  let baseMint: web3.PublicKey;
  let quoteMint: web3.PublicKey;

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
    marketKeypair     = web3.Keypair.generate();
    baseVaultKeypair  = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();

    baseMint  = await createMint(provider.connection, payer.payer, payer.publicKey, null, 6);
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

    // dono traders ko dono tokens do
    await mintTo(provider.connection, payer.payer, quoteMint, bidderQuoteAccount, payer.payer, 1_200_000_000_000);
    await mintTo(provider.connection, payer.payer, baseMint,  bidderBaseAccount,  payer.payer, 600_000_000_000);
    await mintTo(provider.connection, payer.payer, baseMint,  askerBaseAccount,   payer.payer, 600_000_000_000);
    await mintTo(provider.connection, payer.payer, quoteMint, askerQuoteAccount,  payer.payer, 1_200_000_000_000);

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

  // ─────────────────────────────────────────────────────────────────
  // TEST 1 — Initialize Market
  // ─────────────────────────────────────────────────────────────────
  it("should initialize market with all parameters correctly", async () => {
    await program.methods
      .initialiseMarket(BASE_LOT_SIZE, QUOTE_LOT_SIZE, MAKER_FEES_BPS, TAKER_FEES_BPS)
      .accounts({
        market:        marketKeypair.publicKey,
        bids:          bidsPda,
        asks:          asksPda,
        baseVault:     baseVaultKeypair.publicKey,
        quoteVault:    quoteVaultKeypair.publicKey,
        vaultSigner:   vaultSignerPda,
        baseMint,
        quoteMint,
        admin:         payer.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram:  TOKEN_PROGRAM_ID,
      })
      .signers([marketKeypair, baseVaultKeypair, quoteVaultKeypair, payer.payer])
      .rpc();

    console.log("market :",     marketKeypair.publicKey.toString());
    console.log("quote mint:",  quoteMint.toString());
    console.log("base mint:",   baseMint.toString());

    const market = await program.account.market.fetch(marketKeypair.publicKey);
    assert.isTrue(market.baseLotSize.eq(BASE_LOT_SIZE));
    assert.isTrue(market.quoteLotSize.eq(QUOTE_LOT_SIZE));
    assert.isTrue(market.makerFeesBps.eq(MAKER_FEES_BPS));
    assert.isTrue(market.takerFeesBps.eq(TAKER_FEES_BPS));
    assert.strictEqual(market.admin.toString(), payer.publicKey.toString());
    assert.strictEqual(market.vaultSignerNonce, vaultSignerBump);
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 2 — Asker ASK + Bidder BID → match hoga
  // ─────────────────────────────────────────────────────────────────
  it("should place limit order", async () => {
    //
    // Numbers:
    //   maxBaseSize  = 5_000_000 raw base = 5 base tokens (6 decimals)
    //   price        = 100_000_000 raw quote per base token
    //   base_lots    = 5_000_000 / 1_000 = 5_000
    //   quote_lots   = 100_000_000 / 1_000 = 100_000
    //
    //   ASK lock  = base_lots * base_lot_size = 5_000 * 1_000 = 5_000_000 raw base
    //   BID lock  = quote_lots * base_lots * quote_lot_size
    //             = 100_000 * 5_000 * 1_000 = 500_000_000_000 raw quote
    //

    const maxBaseSize   = new BN(5_000_000);
    const price         = new BN(100_000_000);

    // ── Step 1: Asker places ASK (sells base) ──
    // { ask: {} } → base lock hoga
    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(1),
        price,
        { limit: {} },
        { ask: {} },          // ← asker SELL kar raha hai base
      )
      .accounts({
        market:         marketKeypair.publicKey,
        bids:           bidsPda,
        asks:           asksPda,
        baseVault:      baseVaultKeypair.publicKey,
        quoteVault:     quoteVaultKeypair.publicKey,
        vaultSigner:    vaultSignerPda,
        userBaseVault:  askerBaseAccount,   // asker base dega
        userQuoteVault: askerQuoteAccount,
        openOrder:      askerOpenOrderPda,
        owner:          asker.publicKey,
        tokenProgram:   TOKEN_PROGRAM_ID,
        systemProgram:  web3.SystemProgram.programId,
      })
      .signers([asker])
      .rpc();
      const market = await program.account.market.fetch(marketKeypair.publicKey);

      let askerBaseLocked = market.traderEntry[0].traderState.baseLotsLocked;
  
      assert.equal(5000000,askerBaseLocked.toNumber(),"base locked should be 5_000_000")
    // base vault mein 5_000_000 hona chahiye (asker ka base lock hua)
    const baseVaultAfterAsk = await getAccount(provider.connection, baseVaultKeypair.publicKey);
    console.log("base vault after ask:", baseVaultAfterAsk.amount.toString());
    assert.equal(
      baseVaultAfterAsk.amount.toString(),
      "5000000",
      "base vault should hold 5_000_000 raw base after ask"
    );

    // ── Step 2: Bidder places BID (buys base) → match hoga asker ke saath ──
    // { bid: {} } → quote lock hoga, asker ke ask ke saath match hoga
    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(2),
        price,
        { limit: {} },
        { bid: {} },          // ← bidder BUY kar raha hai base
      )
      .accounts({
        market:         marketKeypair.publicKey,
        bids:           bidsPda,
        asks:           asksPda,
        baseVault:      baseVaultKeypair.publicKey,
        quoteVault:     quoteVaultKeypair.publicKey,
        vaultSigner:    vaultSignerPda,
        userBaseVault:  bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount, // bidder quote dega
        openOrder:      bidderOpenOrderPda,
        owner:          bidder.publicKey,
        tokenProgram:   TOKEN_PROGRAM_ID,
        systemProgram:  web3.SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();
      console.log("length:",market.traderEntry.length)
      let bidderQuoteLocked = market.traderEntry[1].traderState.quoteLotsLocked;
      assert.equal(0,askerBaseLocked.toNumber(),"base locked should be 0")
      assert.equal(0,bidderQuoteLocked.toNumber(),"quote locked should be 0")
    // 2 orders placed → next_order_id = 2
    assert.equal(
      market.nextOrderId.toNumber(),
      2,
      "next_order_id should be 2 after two orders"
    );

    // base vault: 5_000_000 (asker ka base abhi bhi vault mein — settlement pending)
    const baseVaultFinal = await getAccount(provider.connection, baseVaultKeypair.publicKey);
    console.log("base vault final:", baseVaultFinal.amount.toString());
    assert.equal(
      baseVaultFinal.amount.toString(),
      "5000000",
      "base vault should hold 5_000_000 raw base units"
    );

    // quote vault: 500_000_000_000 (bidder ka quote locked)
    const quoteVaultFinal = await getAccount(provider.connection, quoteVaultKeypair.publicKey);
    console.log("quote vault final:", quoteVaultFinal.amount.toString());
    assert.equal(
      quoteVaultFinal.amount.toString(),
      "500000000000",
      "quote vault should hold 500_000_000_000 raw quote units"
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 3 — Bidder places another BID
  // ─────────────────────────────────────────────────────────────────
  it("should place limit bid order and match with existing ask", async () => {
    //
    // State after test 2:
    //   asker  → ASK placed, base locked, matched with bidder's BID
    //   bidder → BID placed, quote locked, matched with asker's ASK
    //   trader entries updated, next_order_id = 2
    //
    // Test 3: bidder places another BID (3 base tokens at same price)
    //   base_lots  = 3_000_000 / 1_000 = 3_000
    //   quote_lots = 100_000_000 / 1_000 = 100_000
    //   quote lock = 100_000 * 3_000 * 1_000 = 300_000_000_000 additional
    //

    const maxBaseSize   = new BN(3_000_000);
    const price         = new BN(100_000_000);

    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(3),
        price,
        { limit: {} },
        { bid: {} },          // ← bidder fir se BUY kar raha hai
      )
      .accounts({
        market:         marketKeypair.publicKey,
        bids:           bidsPda,
        asks:           asksPda,
        baseVault:      baseVaultKeypair.publicKey,
        quoteVault:     quoteVaultKeypair.publicKey,
        vaultSigner:    vaultSignerPda,
        userBaseVault:  bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        openOrder:      bidderOpenOrderPda,
        owner:          bidder.publicKey,
        tokenProgram:   TOKEN_PROGRAM_ID,
        systemProgram:  web3.SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();

    const market = await program.account.market.fetch(marketKeypair.publicKey);

    // 3 orders total → next_order_id = 3
    assert.equal(
      market.nextOrderId.toNumber(),
      3,
      "next_order_id should be 3 after third order"
    );

    // quote vault = previous 500_000_000_000 + new 300_000_000_000 = 800_000_000_000
    // (agar no match hua — asks slab mein koi matching order nahi tha)
    const quoteVaultFinal = await getAccount(provider.connection, quoteVaultKeypair.publicKey);

    // bidder ka entry exist karna chahiye
    const bidderEntry = market.traderEntry.find(
      (e: any) => e.traderKey.toString() === bidder.publicKey.toString()
    );
    assert.ok(bidderEntry, "bidder entry should exist in trader map");
    console.log("quote locked:",bidderEntry.traderState.quoteLotsLocked.toString())
    console.log("base locked:",bidderEntry.traderState.baseLotsLocked.toString())
    console.log("base free:",bidderEntry.traderState.baseLotsFree.toString())
    console.log("quote free:",bidderEntry.traderState.baseLotsFree.toString())
    console.log("entries:",market.traderEntry.length)
    assert.ok(
      new BN(bidderEntry.traderState.quoteLotsLocked).gtn(0),
      "bidder quote should be locked after bid order"
    );
  });
});