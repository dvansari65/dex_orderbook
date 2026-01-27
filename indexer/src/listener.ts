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

  /**
   * Start listening to program events
   * Returns cleanup function
   */
  async start(callback: (event: any) => void): Promise<() => Promise<void>> {
    console.log("🎧 Starting event listener for:", this.program.programId.toString());

    this.logSubscriptionId = this.connection.onLogs(
      this.program.programId,
      (logs) => {
        // Skip failed transactions early
        if (logs.err) {
          console.log("❌ Transaction failed:", logs.signature);
          return;
        }

        try {
          const events = Array.from(this.eventParser.parseLogs(logs.logs));

          if (events.length === 0) {
            return; // No events to process
          }

          // Process each event
          events.forEach((event) => {
            // Filter only relevant order events
            if (this.isRelevantEvent(event.name)) {
              console.log(`📨 ${event.name}:`, {
                price: event.data.price?.toString(),
                quantity: event.data.baseLots?.toString(),
                side: event.data.side,
              });
              callback(event);
            }
          });
        } catch (error) {
          console.error("⚠️ Error parsing events:", error);
        }
      },
      "confirmed"
    );

    console.log("✅ Event listener active");

    // Return cleanup function
    return async () => {
      await this.stop();
    };
  }

  /**
   * Check if event is relevant for orderbook updates
   */
  private isRelevantEvent(eventName: string): boolean {
    const relevantEvents = [
      "orderPlacedEvent",
      "orderFillEvent",
      "orderPartialFillEvent",
      "orderCancelEvent",
    ];
    return relevantEvents.includes(eventName);
  }

  /**
   * Stop listening to program logs
   */
  async stop(): Promise<void> {
    if (this.logSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.logSubscriptionId);
        console.log("🔕 Unsubscribed from event logs");
        this.logSubscriptionId = null;
      } catch (error) {
        console.error("Error unsubscribing from logs:", error);
      }
    }
  }

  /**
   * Fetch market state from chain
   */
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
      console.error("❌ Error fetching market state:", error);
      return null;
    }
  }

  /**
   * Fetch ask slab (sell orders)
   */
  async fetchAskSlabState(askSlabKey: string): Promise<Slab | null> {
    return this.fetchSlabState(askSlabKey, "ask");
  }

  /**
   * Fetch bid slab (buy orders)
   */
  async fetchBidSlabState(bidSlabKey: string): Promise<Slab | null> {
    return this.fetchSlabState(bidSlabKey, "bid");
  }

  /**
   * Generic slab fetcher with error handling
   */
  private async fetchSlabState(
    slabKey: string,
    side: "ask" | "bid"
  ): Promise<Slab | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(slabKey)
      );

      if (!accountInfo) {
        throw new Error(`${side} slab account not found`);
      }

      const slabData = this.program.coder.accounts.decode(
        "slab",
        accountInfo.data
      );

      if (!slabData) {
        throw new Error(`Failed to decode ${side} slab data`);
      }

      return slabData;
    } catch (error) {
      console.error(`❌ Error fetching ${side} slab:`, error);
      return null;
    }
  }

  /**
   * Fetch event queue state
   */
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

  /**
   * Subscribe to account changes
   * Returns subscription ID for cleanup
   */
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

    // Track subscription for cleanup
    this.accountSubscriptions.set(accountPubKey, subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from specific account
   */
  async unsubscribeFromAccount(subscriptionId: number): Promise<void> {
    try {
      await this.connection.removeAccountChangeListener(subscriptionId);
      console.log(`🔕 Unsubscribed: ${subscriptionId}`);

      // Remove from tracking
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

  /**
   * Clean up all subscriptions
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up all subscriptions...");

    // Stop log subscription
    await this.stop();

    // Unsubscribe from all account changes
    const unsubscribePromises = Array.from(
      this.accountSubscriptions.values()
    ).map((id) => this.unsubscribeFromAccount(id));

    await Promise.all(unsubscribePromises);

    this.accountSubscriptions.clear();
    console.log("✅ Cleanup complete");
  }

  /**
   * Get current connection health
   */
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