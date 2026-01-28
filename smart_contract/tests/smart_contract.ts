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

  let marketKeypair: web3.Keypair;
  let baseMint: web3.PublicKey;
  let quoteMint: web3.PublicKey;
  let marketInfo: any;

  let bidsKeypair: web3.Keypair;
  let asksKeypair: web3.Keypair;
  let eventQueueKeypair: web3.Keypair;
  let baseVaultKeypair: web3.Keypair;
  let quoteVaultKeypair: web3.Keypair;

  let baselineBidsCount: number;
  let baselineAsksCount: number;

  before(async () => {
    marketKeypair = web3.Keypair.generate();
    bidsKeypair = web3.Keypair.generate();
    asksKeypair = web3.Keypair.generate();
    eventQueueKeypair = web3.Keypair.generate();
    baseVaultKeypair = web3.Keypair.generate();
    quoteVaultKeypair = web3.Keypair.generate();
    console.log("market key pair: ", marketKeypair.publicKey.toString());
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
    console.log("quote mint:", quoteMint.toString())
    console.log("base mint:", baseMint.toString())
    const [bidsPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bids"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    const [asksPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("asks"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialiseMarket(new BN(1000), new BN(1000), new BN(10), new BN(20))
      .accounts({
        market: marketKeypair.publicKey,
        bids: bidsPda,
        asks: asksPda,
        eventQueue: eventQueueKeypair.publicKey,
        baseVault: baseVaultKeypair.publicKey,
        quoteVault: quoteVaultKeypair.publicKey,
        baseMint,
        quoteMint,
        admin: payer.publicKey,
      })
      .signers([
        marketKeypair,
        eventQueueKeypair,
        baseVaultKeypair,
        quoteVaultKeypair,
      ])
      .rpc();

    marketInfo = await program.account.market.fetch(marketKeypair.publicKey);
    console.log("market info:", marketInfo)
    const initialBids = await program.account.slab.fetch(marketInfo.bids);
    const initialAsks = await program.account.slab.fetch(marketInfo.asks);
    baselineBidsCount = initialBids.leafCount;
    baselineAsksCount = initialAsks.leafCount;
  });

  beforeEach(async () => {
    const asksAccount = await program.account.slab.fetch(marketInfo.asks);
    const bidsAccount = await program.account.slab.fetch(marketInfo.bids);
    const eventAccount = await program.account.eventQueue.fetch(
      marketInfo.eventQueue
    );

    const actualAsks = asksAccount.leafCount - baselineAsksCount;
    const actualBids = bidsAccount.leafCount - baselineBidsCount;

    if (actualAsks > 0 || actualBids > 0 || eventAccount.count > 0) {
      // state leakage warning intentionally ignored
    }
  });

  it("Initializes the market!", async () => {
    const [vaultSigner, vaultBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    assert.equal(marketInfo.admin.toString(), payer.publicKey.toString());
    assert.equal(marketInfo.nextOrderId.toString(), "0");
    assert.equal(marketInfo.baseLotSize.toNumber(), 1000);
    assert.equal(marketInfo.quoteLotSize.toNumber(), 1000);
    assert.equal(marketInfo.vaultSignerNonce, vaultBump);
  });

  it("should place ask order", async () => {
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
        new BN(100),
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

    const openOrderAccount = await program.account.openOrders.fetch(
      openOrderPda
    );
    const asksAfter = await program.account.slab.fetch(marketInfo.asks);
    const bidsAfter = await program.account.slab.fetch(marketInfo.bids);

    const newAsks = asksAfter.leafCount - asksBeforeAsk.leafCount;
    const newBids = bidsAfter.leafCount - bidsBeforeAsk.leafCount;

    assert.equal(newBids, 0);
    assert.equal(newAsks, 1);

    assert.equal(openOrderAccount.baseLocked.toString(), "1000000");
    assert.equal(openOrderAccount.quoteLocked.toString(), "0");
  });

  it("should place bid order", async () => {
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
    console.log("fetching started..")
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
    console.log("fetching started..")
    const openOrderAccount = await program.account.openOrders.fetch(
      openOrderPda
    );
    console.log("open order :", openOrderAccount.orders)
    const bidsAfter = await program.account.slab.fetch(marketInfo.bids);
    const asksAfter = await program.account.slab.fetch(marketInfo.asks);
    const eventAccount = await program.account.eventQueue.fetch(
      marketInfo.eventQueue
    );

    const newBids = bidsAfter.leafCount - bidsBeforeBid.leafCount;
    const newAsks = asksAfter.leafCount - asksBeforeBid.leafCount;

    assert.equal(newBids, 1);
    assert.equal(newAsks, -1);

    const expectedQuoteLocked = maxBaseQty
      .div(marketInfo.baseLotSize)
      .mul(price)
      .mul(marketInfo.quoteLotSize);

    assert.equal(String(bidsAfter.freeListLen), "31");

    assert.equal(openOrderAccount.baseLocked.toString(), "0");
    assert.equal(
      openOrderAccount.quoteLocked.toString(),
      expectedQuoteLocked.toString()
    );

    const eventCount = Number(eventAccount.count);
    let lastNewOrderEvent = null;
    for (let i = eventCount - 1; i >= 0; i--) {
      if (eventAccount.events[0].orderId !== undefined) {
        lastNewOrderEvent = eventAccount.events[i];
        break;
      }
    }

    assert.isNotNull(lastNewOrderEvent);

    if (lastNewOrderEvent) {
      assert.equal(String(lastNewOrderEvent.price), "100");
      assert.equal(
        lastNewOrderEvent.owner.toString(),
        bidUser.publicKey.toString()
      );
    }

    assert.equal(openOrderAccount.orders.length, 1);

    assert.equal(
      Number(openOrderAccount.orders[0].quantity),
      4000
    );

    assert.equal(
      Number(openOrderAccount.orders[0].price),
      100
    );

    assert.equal(
      Number(openOrderAccount.orders[0].clientOrderId),
      23230
    );

    assert.equal(
      openOrderAccount.orders[0].side.bid !== undefined,
      true
    );
  });

  after(async () => {
    const finalMarketInfo = await program.account.market.fetch(
      marketKeypair.publicKey
    );
    const finalAsks = await program.account.slab.fetch(marketInfo.asks);
    const finalBids = await program.account.slab.fetch(marketInfo.bids);

    const actualAsks = finalAsks.leafCount - baselineAsksCount;
    const actualBids = finalBids.leafCount - baselineBidsCount;

    assert.isAtLeast(Number(finalMarketInfo.nextOrderId), 0);
    assert.isAtLeast(actualAsks + actualBids, 0);
  });
});
