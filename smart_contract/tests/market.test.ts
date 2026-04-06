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
    marketKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();

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

    await mintTo(provider.connection, payer.payer, quoteMint, bidderQuoteAccount, payer.payer, 1_200_000_000_000);
    await mintTo(provider.connection, payer.payer, baseMint, bidderBaseAccount, payer.payer, 600_000_000_000);
    await mintTo(provider.connection, payer.payer, baseMint, askerBaseAccount, payer.payer, 600_000_000_000);
    await mintTo(provider.connection, payer.payer, quoteMint, askerQuoteAccount, payer.payer, 1_200_000_000_000);

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
      })
      .signers([marketKeypair, baseVaultKeypair, quoteVaultKeypair, payer.payer])
      .rpc();

    console.log("market :", marketKeypair.publicKey.toString());
    console.log("quote mint:", quoteMint.toString());
    console.log("base mint:", baseMint.toString());

    const market = await program.account.market.fetch(marketKeypair.publicKey);
    assert.isTrue(market.baseLotSize.eq(BASE_LOT_SIZE));
    assert.isTrue(market.quoteLotSize.eq(QUOTE_LOT_SIZE));
    assert.isTrue(market.makerFeesBps.eq(MAKER_FEES_BPS));
    assert.isTrue(market.takerFeesBps.eq(TAKER_FEES_BPS));
    assert.strictEqual(market.admin.toString(), payer.publicKey.toString());
    assert.strictEqual(market.vaultSignerNonce, vaultSignerBump);
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 2 — Asker ASK + Bidder BID → match
  // ─────────────────────────────────────────────────────────────────
  it("should place limit order", async () => {
    //
    // Raw inputs:
    //   maxBaseSize = 5_000_000 raw base
    //   price       = 100_000_000 raw quote per base token
    //
    // Lot conversions (lot_size = 1_000):
    //   base_lots  = 5_000_000  / 1_000 = 5_000
    //   quote_lots = 100_000_000 / 1_000 = 100_000
    //
    // ASK lock (raw) = base_lots * base_lot_size = 5_000 * 1_000 = 5_000_000
    // BID lock (raw) = quote_lots * base_lots * quote_lot_size
    //                = 100_000 * 5_000 * 1_000 = 500_000_000_000
    //
    // TraderState stores LOTS:
    //   asker.base_lots_locked = 5_000
    //   asker.base_lots_free   = (600_000_000_000 - 5_000_000) / 1_000 = 599_995_000
    //
    // After match:
    //   bidder.quote_lots_free = (1_200_000_000_000 - 500_000_000_000) / 1_000 = 700_000_000
    //   bidder.base_lots_free  = (600_000_000_000 + 5_000_000) / 1_000 = 600_005_000
    //   asker.base_lots_locked = 0
    //   bidder.quote_lots_locked = 0

    const maxBaseSize = new BN(5_000_000);
    const price = new BN(100_000_000);

    // ── Step 1: Asker places ASK ──
    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(1),
        price,
        { limit: {} },
        { ask: {} },
      )
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsPda,
        asks: asksPda,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        vaultSigner: vaultSignerPda,
        userBaseVault: askerBaseAccount,
        userQuoteVault: askerQuoteAccount,
        openOrder: askerOpenOrderPda,
        owner: asker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([asker])
      .rpc();

    const marketAfterAsk = await program.account.market.fetch(marketKeypair.publicKey);
    const askerEntry = marketAfterAsk.traderEntry[0].traderState;

    // TraderState in LOTS
    assert.equal(
      askerEntry.baseLotsLocked.toNumber(),
      5_000,
      "asker base_lots_locked = 5_000 lots"
    );
    assert.equal(
      askerEntry.baseLotsFree.toNumber(),
      599_995_000,
      "asker base_lots_free = 599_995_000 lots"
    );

    // Vault holds RAW tokens
    const baseVaultAfterAsk = await getAccount(provider.connection, baseVaultKeypair.publicKey);
    assert.equal(
      baseVaultAfterAsk.amount.toString(),
      "5000000",
      "base vault = 5_000_000 raw after ask"
    );

    // ── Step 2: Bidder places BID → matches asker's ASK ──
    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(2),
        price,
        { limit: {} },
        { bid: {} },
      )
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsPda,
        asks: asksPda,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        vaultSigner: vaultSignerPda,
        userBaseVault: bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        openOrder: bidderOpenOrderPda,
        owner: bidder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();

    const marketAfterMatch = await program.account.market.fetch(marketKeypair.publicKey);
    const askerAfter  = marketAfterMatch.traderEntry[0].traderState;
    const bidderAfter = marketAfterMatch.traderEntry[1].traderState;

    // After match — asker base fully unlocked
    assert.equal(
      askerAfter.baseLotsLocked.toNumber(),
      0,
      "asker base_lots_locked = 0 after match"
    );

    // Bidder received base, quote deducted — all in LOTS
    assert.equal(
      bidderAfter.quoteLotsFree.toNumber(),
      700_000_000,
      "bidder quote_lots_free = 700_000_000 lots"
    );
    assert.equal(
      bidderAfter.baseLotsFree.toNumber(),
      600_005_000,
      "bidder base_lots_free = 600_005_000 lots"
    );
    assert.equal(
      bidderAfter.quoteLotsLocked.toNumber(),
      0,
      "bidder quote_lots_locked = 0 after match"
    );

    // next_order_id = 2 after two orders
    assert.equal(
      marketAfterMatch.nextOrderId.toNumber(),
      2,
      "next_order_id = 2"
    );

    // Vaults hold RAW tokens
    const baseVaultFinal = await getAccount(provider.connection, baseVaultKeypair.publicKey);
    assert.equal(
      baseVaultFinal.amount.toString(),
      "5000000",
      "base vault = 5_000_000 raw"
    );

    const quoteVaultFinal = await getAccount(provider.connection, quoteVaultKeypair.publicKey);
    assert.equal(
      quoteVaultFinal.amount.toString(),
      "500000000000",
      "quote vault = 500_000_000_000 raw"
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 3 — Bidder places another BID (no matching ask exists)
  // ─────────────────────────────────────────────────────────────────
  it("should place limit bid order and match with existing ask", async () => {
    //
    // State after test 2:
    //   asker  → base unlocked, match complete
    //   bidder → base received, quote deducted
    //   next_order_id = 2
    //
    // Test 3: bidder places new BID for 3 base tokens at same price
    //   base_lots  = 3_000_000 / 1_000 = 3_000
    //   quote_lots = 100_000_000 / 1_000 = 100_000
    //   additional quote lock (raw) = 100_000 * 3_000 * 1_000 = 300_000_000_000
    //
    // No matching ask → order goes to bids slab
    // bidder.quote_lots_locked = 100_000 * 3_000 = 300_000_000 lots

    const maxBaseSize = new BN(3_000_000);
    const price = new BN(100_000_000);

    await program.methods
      .placeLimitOrder(
        maxBaseSize,
        new BN(3),
        price,
        { limit: {} },
        { bid: {} },
      )
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsPda,
        asks: asksPda,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        vaultSigner: vaultSignerPda,
        userBaseVault: bidderBaseAccount,
        userQuoteVault: bidderQuoteAccount,
        openOrder: bidderOpenOrderPda,
        owner: bidder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();

    const market = await program.account.market.fetch(marketKeypair.publicKey);

    // next_order_id = 3 after third order
    assert.equal(
      market.nextOrderId.toNumber(),
      3,
      "next_order_id = 3"
    );

    const bidderEntry = market.traderEntry.find(
      (e: any) => e.traderKey.toString() === bidder.publicKey.toString()
    );
    assert.ok(bidderEntry, "bidder entry should exist");

    const bs = bidderEntry.traderState;
    console.log("quote_lots_locked:", bs.quoteLotsLocked.toString());
    console.log("base_lots_locked: ", bs.baseLotsLocked.toString());
    console.log("base_lots_free:   ", bs.baseLotsFree.toString());
    console.log("quote_lots_free:  ", bs.quoteLotsFree.toString());
    console.log("total entries:    ", market.traderEntry.length);

    // bidder locked quote for the new bid = 100_000 * 3_000 = 300_000_000 lots
    assert.equal(
      bs.quoteLotsLocked.toNumber(),
      300_000_000,
      "bidder quote_lots_locked = 300_000_000 lots after new bid"
    );

    // quote vault: previous 500_000_000_000 + new 300_000_000_000 = 800_000_000_000 raw
    const quoteVaultFinal = await getAccount(provider.connection, quoteVaultKeypair.publicKey);
    assert.equal(
      quoteVaultFinal.amount.toString(),
      "800000000000",
      "quote vault = 800_000_000_000 raw after second bid"
    );
  });
});