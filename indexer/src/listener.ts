import { AnchorProvider, Program, EventParser } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/orderbook.json";

export class EventListener {
  private connection: Connection;
  private program: Program;
  private eventParser: EventParser;

  constructor(rpcURL: string, programId: string) {
    this.connection = new Connection(rpcURL, "confirmed");
    const provider = new AnchorProvider(
      this.connection,
      {} as any,
      { commitment: "confirmed" }
    );
    this.program = new Program(idl as any, provider);
    this.eventParser = new EventParser(
      new PublicKey(programId),
      this.program.coder
    );
  }

  async start(callback: (event: any) => void) {
    console.log("🎧 Listening for events...");

    // Subscribe to program logs
    this.connection.onLogs(
      this.program.programId,
      async (logs) => {
        if (logs.err) return;

        // Parse events from logs
        const events = this.eventParser.parseLogs(logs.logs);
        
        for (const event of events) {
          callback({
            type: event.name,
            data: event.data,
            slot: logs.logs,
          });
        }
      },
      "confirmed"
    );
  }

  async fetchMarketState(marketPubKey: string) {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(marketPubKey)
      );

      if (!accountInfo) {
        throw new Error("Market not found!");
      }

      // Deserialize market account
      const marketData = this.program.coder.accounts.decode(
        "market",
        accountInfo.data
      );

      return marketData;
    } catch (error) {
      console.error("Error fetching market:", error);
      return null;
    }
  }
}