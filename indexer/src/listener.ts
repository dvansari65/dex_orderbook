import { AnchorProvider, Program, EventParser, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/orderbook.json";
import { Market, Slab } from "./types";

export class EventListener {
    private connection: Connection;
    private program: Program;
    private eventParser: EventParser;

    constructor(rpcURL: string, programId: string) {
        this.connection = new Connection(rpcURL, {
            commitment: "confirmed",
            wsEndpoint: "ws://127.0.0.1:8900",
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

    async start(callback: (event: any) => void) {
        console.log("🎧 Listening...");

        this.connection.onLogs(
            this.program.programId,
            (logs) => {
                if (logs.err) return;

                const events = Array.from(this.eventParser.parseLogs(logs.logs));

                if (events.length > 0) {
                    console.log("✅ Events found:", events.length);

                    events.forEach((event) => {
                        console.log("📨 Event:", event.name, event.data);
                        callback({
                            type: event.name,
                            data: event.data,
                        });
                    });
                }
            },
            "confirmed"
        );

        console.log("✅ Subscribed to:", this.program.programId.toString());
    }

    // async getMarketPda (baseMint:string,quoteMint:string){
    //     const [marketPda] = await 
    // }
    async fetchMarketState(marketPubKey: string):Promise<Market | null> {
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
    async fetchAskSlabState (slabPubKey:string):Promise<Slab | null> {
        try {
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(slabPubKey))
            if(!accountInfo){
                throw new Error("Slab account not found!")
            }
            const slabData = this.program.coder.accounts.decode("slab",accountInfo.data)
            if(!slabData){
                throw new Error("Ask slab account not found!")
            }
            return slabData
        } catch (error) {
            console.error("Error fetching slab:", error);
            return null;
        }
    }
    async fetchBidSlabState (bidSlabKey:string):Promise<Slab | null>{
        try {
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(bidSlabKey))
            if(!accountInfo){
                throw new Error("Bid Slab account not found!")
            }
            const bidSlab = this.program.coder.accounts.decode("slab",accountInfo?.data)
            return bidSlab;
        } catch (error) {
            console.error("Error fetching bid slab:", error);
            return null;
        }
    }
}
