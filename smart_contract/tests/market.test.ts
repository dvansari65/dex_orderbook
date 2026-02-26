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

describe("orderbook - initialize_market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.orderbook as Program<Orderbook>;
  const payer = provider.wallet as anchor.Wallet;

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

  before(async () => {
    marketKeypair = web3.Keypair.generate();
    baseMint = await createMint(provider.connection, payer.payer, payer.publicKey, null, 6);
    quoteMint = await createMint(provider.connection, payer.payer, payer.publicKey, null, 6);
  });

  beforeEach(() => {
    eventQueueKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();
  });

  it("should initialize market with all parameters correctly", async () => {
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
    assert.strictEqual(market.bids.toString(), bidsPda.toString());
    assert.strictEqual(market.asks.toString(), asksPda.toString());
    assert.strictEqual(market.vaultSignerNonce, vaultSignerBump);
    
    const baseVaultAccount = await getAccount(provider.connection, baseVaultKeypair.publicKey);
    assert.strictEqual(baseVaultAccount.owner.toString(), vaultSignerPda.toString());
  });

  it("should place limit order", async () => {
    const base = new BN(5000000);
    const client_order_id = new BN(1);
    const price = new BN(100000000);
    const order_type = { limit: {} };
    const side = { bid: {} };
  
    const [asksPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("asks"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
  
    const [bidsPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bids"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );
  
    const [openOrderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("open_order"), marketKeypair.publicKey.toBuffer(), payer.publicKey.toBuffer()],
      program.programId
    );
  
    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
  
    const userQuoteTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      quoteMint,
      payer.publicKey
    );
  
    const userBaseTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      baseMint,
      payer.publicKey
    );
  
    await mintTo(
      provider.connection,
      payer.payer,
      quoteMint,
      userQuoteTokenAccount,
      payer.payer,
      600_000_000_000
    );
    const openOrderTx = await program.methods
            .initializeOpenOrder()
            .accounts({
              openOrder:openOrderPda,
              market:marketKeypair.publicKey,
              owner:payer.publicKey,
              systemProgram:web3.SystemProgram.programId
            })
            .rpc()
    console.log("open order tx:",openOrderTx)
    // --- pre-tx snapshots ---
    const marketBefore       = await program.account.market.fetch(marketKeypair.publicKey);
    const userQuoteBefore    = await getAccount(provider.connection, userQuoteTokenAccount);
    const quoteVaultBefore   = await getAccount(provider.connection, marketAccount.quoteVault);
  
    // --- derived expected values (mirrors on-chain math exactly) ---
    const baseLots   = base.div(marketBefore.baseLotSize);                  // 5000000 / 1000 = 5000
    const quoteLots  = price.div(marketBefore.quoteLotSize);                // 100000000 / 1000 = 100000
    const amountToLock = quoteLots.mul(baseLots).mul(marketBefore.quoteLotSize); // 100000 * 5000 * 1000 = 500_000_000_000
  
    await program.methods
      .placeLimitOrder(base, client_order_id, price, order_type, side)
      .accounts({
        market:         marketKeypair.publicKey,
        asks:           asksPda,
        bids:           bidsPda,
        openOrder:      openOrderPda,
        eventQueue:     marketAccount.eventQueue,
        quoteVault:     marketAccount.quoteVault,
        baseVault:      marketAccount.baseVault,
        userBaseVault:  userBaseTokenAccount,
        userQuoteVault: userQuoteTokenAccount,
        owner:          payer.publicKey,
        tokenProgram:   TOKEN_PROGRAM_ID,
      })
      .rpc();
  
    // --- post-tx snapshots ---
    const marketAfter      = await program.account.market.fetch(marketKeypair.publicKey);
    const openOrderAccount = await program.account.openOrders.fetch(openOrderPda);
    const userQuoteAfter   = await getAccount(provider.connection, userQuoteTokenAccount);
    const quoteVaultAfter  = await getAccount(provider.connection, marketAccount.quoteVault);
  
    // 1. nextOrderId incremented correctly (twice in instruction — top + bottom)
    assert.equal(
      marketAfter.nextOrderId.toNumber(),
      marketBefore.nextOrderId.toNumber() + 2,
      "nextOrderId should increment by 2"
    );
    console.log("openOrderAccount.ordersCount:",openOrderAccount.ordersCount)
    // 2. open order recorded the order
    assert.equal(openOrderAccount.ordersCount, 1, "ordersCount should be 1");
  
    // 3. correct quote amount locked in open order
    assert.isTrue(
      openOrderAccount.quoteLocked.eq(amountToLock),
      `quoteLocked should be ${amountToLock.toString()}`
    );
  
    // 4. exact tokens deducted from user
    assert.equal(
      userQuoteAfter.amount,
      userQuoteBefore.amount - BigInt(amountToLock.toString()),
      "user quote balance should decrease by exact amountToLock"
    );
  
    // 5. exact tokens credited to quote vault
    assert.equal(
      quoteVaultAfter.amount,
      quoteVaultBefore.amount + BigInt(amountToLock.toString()),
      "quote vault balance should increase by exact amountToLock"
    );
  
    // 6. open order is linked to correct market and owner
    assert.strictEqual(openOrderAccount.market.toString(), marketKeypair.publicKey.toString(), "open order market mismatch");
    assert.strictEqual(openOrderAccount.owner.toString(), payer.publicKey.toString(), "open order owner mismatch");
  });
});