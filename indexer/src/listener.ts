import { AnchorProvider, Program, EventParser, Idl } from "@coral-xyz/anchor";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/orderbook.json";
import { Event, EventQueue, Market, Slab } from "../types/market";

export class EventListener {
  private connection: Connection;
  private program: Program;
  private eventParser: EventParser;
  private logSubscriptionId: number | null = null;
  private accountSubscriptions: Map<string, number> = new Map();

  constructor(rpcURL: string, programId: string) {
    this.connection = new Connection(rpcURL, {
      commitment: "confirmed",
      wsEndpoint: rpcURL.replace("http", "ws").replace("8899", "8900"),
    });

    const provider = new AnchorProvider(this.connection, {} as any, {
      commitment: "confirmed",
    });

    this.program = new Program(idl as Idl, provider);
    this.eventParser = new EventParser(
      new PublicKey(programId),
      this.program.coder
    );
  }

  async start(callback: (event: any) => void): Promise<() => Promise<void>> {
    console.log("🎧 Starting event listener for:", this.program.programId.toString());

    this.logSubscriptionId = this.connection.onLogs(
      this.program.programId,
      (logs) => {
        if (logs.err) {
          console.log("❌ Transaction failed:", logs.signature);
          return;
        }

        try {
          const events = Array.from(this.eventParser.parseLogs(logs.logs));

          if (events.length === 0) {
            return;
          }

         const relevant = events
                      .filter((e)=>this.isRelevantEvent(e.name))
                      .map((e)=>({...e,signature:logs.signature}))
          if (relevant.length === 0) return;
          callback(relevant)
          
        } catch (error) {
          console.error("⚠️ Error parsing events:", error);
        }
      },
      "confirmed"
    );

    console.log("✅ Event listener active");

    return async () => {
      await this.stop();
    };
  }

  private isRelevantEvent(eventName: string): boolean {
    const relevantEvents = [
      "orderPlacedEvent",
      "orderFillEvent",
      "orderPartialFillEvent",
      "orderCancelEvent",
    ];
    return relevantEvents.includes(eventName);
  }

  async stop(): Promise<void> {
    if (this.logSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.logSubscriptionId);
        this.logSubscriptionId = null;
      } catch (error) {
        console.error("Error unsubscribing from logs:", error);
      }
    }
  }

  async fetchMarketState(marketPubKey: string): Promise<Market | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(marketPubKey)
      );

      if (!accountInfo) {
        throw new Error("Market account not found");
      }

      const marketData = this.program.coder.accounts.decode(
        "market",
        accountInfo.data
      );

      return marketData;
    } catch (error) {
      console.error("Error fetching market state:", error);
      return null;
    }
  }

  async fetchAskSlabState(askSlabKey: string): Promise<Slab | null> {
   const bidData =  await this.fetchSlabState(askSlabKey, "ask");
    return bidData
  }

  async fetchBidSlabState(bidSlabKey: string): Promise<Slab | null> {
    const bids = await this.fetchSlabState(bidSlabKey, "bid");
    return bids
  }

  private async fetchSlabState(
    slabKey: string,
    side: "ask" | "bid"
  ): Promise<Slab | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(slabKey)
      );

      if (!accountInfo) {
        console.warn(`⚠️ ${side} slab account not found: ${slabKey}`);
        return null;
      }

      if (!accountInfo.data) {
        console.warn("Account has no data!", accountInfo.data);
        return null;
      }

      let slabData;

      try {
        slabData =  this.program.coder.accounts.decode(
          "slab",
          accountInfo.data
        );
      } catch (decodeError: any) {
        console.error(`❌ Decode error for ${side} slab:`, decodeError.message);
        return null;
      }

      if (!slabData) {
        console.warn(`⚠️ Failed to decode ${side} slab data`);
        return null;
      }
      
      return slabData;
    } catch (error: any) {
      console.error(`❌ Error fetching ${side} slab:`, error.message);
      return null;
    }
  }

  async fetchEventQueue(eventPubKey: string): Promise<EventQueue | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(eventPubKey)
      );

      if (!accountInfo) {
        throw new Error("Event queue account not found");
      }

      const eventQueue = this.program.coder.accounts.decode(
        "eventQueue",
        accountInfo.data
      );

      return eventQueue;
    } catch (error) {
      console.error("❌ Error fetching event queue:", error);
      return null;
    }
  }

  async subscribeToAccount(
    accountPubKey: string,
    callback: (accountInfo: AccountInfo<Buffer>) => void
  ): Promise<number> {
    const pubkey = new PublicKey(accountPubKey);

    const subscriptionId = this.connection.onAccountChange(
      pubkey,
      (accountInfo, context) => {
        console.log(
          `🔔 Account ${accountPubKey.slice(0, 8)}... updated at slot ${context.slot}`
        );
        callback(accountInfo);
      },
      "confirmed"
    );

    this.accountSubscriptions.set(accountPubKey, subscriptionId);

    return subscriptionId;
  }

  async unsubscribeFromAccount(subscriptionId: number): Promise<void> {
    try {
      await this.connection.removeAccountChangeListener(subscriptionId);
      console.log(`Unsubscribed: ${subscriptionId}`);

      for (const [key, id] of this.accountSubscriptions.entries()) {
        if (id === subscriptionId) {
          this.accountSubscriptions.delete(key);
          break;
        }
      }
    } catch (error) {
      console.error("Error unsubscribing from account:", error);
    }
  }

  async cleanup(): Promise<void> {
    console.log("Cleaning up all subscriptions...");

    await this.stop();

    const unsubscribePromises = Array.from(
      this.accountSubscriptions.values()
    ).map((id) => this.unsubscribeFromAccount(id));

    await Promise.all(unsubscribePromises);

    this.accountSubscriptions.clear();
    console.log("Cleanup complete");
  }

  async getConnectionHealth(): Promise<{
    connected: boolean;
    slot: number | null;
  }> {
    try {
      const slot = await this.connection.getSlot();
      return { connected: true, slot };
    } catch (error) {
      return { connected: false, slot: null };
    }
  }
}