import { AnchorProvider, Program, EventParser, Idl } from "@coral-xyz/anchor";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/orderbook.json";
import { Event, EventQueue, Market, Slab } from "../types/market";

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
        console.log("this.eventParser:",this.eventParser)
    }

    async start(callback: (event: any) => void) {
        console.log("🎧Listening...");
        console.log("this.program.programId:",this.program.programId);
        
        this.connection.onLogs(
            this.program.programId,
            (logs) => {
                console.log("=== RAW LOGS START ===");
                console.log("Signature:", logs.signature);
                console.log("Error:", logs.err);
                logs.logs.forEach((log, i) => {
                    console.log(`[${i}] ${log}`);
                });
                console.log("=== RAW LOGS END ===");
        
                if (logs.err) {
                    console.log("Transaction failed, skipping");
                    return;
                }
        
                try {
                    const events = Array.from(this.eventParser.parseLogs(logs.logs));
                    console.log("Parsed events count:", events.length);
                    
                    if (events.length > 0) {
                        events.forEach((event) => {
                            console.log("📨 Event:", event.name, event.data);
                            callback(event);
                        });
                    } else {
                        console.log("⚠️ No events parsed from logs");
                    }
                } catch (error) {
                    console.error("Error parsing events:", error);
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
    async fetchEventQueue (eventPubKey:string):Promise<EventQueue | null>{
        try {
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(eventPubKey))
            if(!accountInfo){
                throw new Error("account info not found!")
            }
            const eventQueue = this.program.coder.accounts.decode("eventQueue",accountInfo.data)
            console.log("event data:",eventQueue)
            return eventQueue
        } catch (error) {
            console.error("Error fetching  event account:", error);
            return null;
        }
    }

    async subscribedToAccount (
        accountPubKey:string,
        callback:(accountInfo:AccountInfo<Buffer>)=>void
    ):Promise<number> {
        const pubkey = new PublicKey(accountPubKey)
        const subscriptionId = this.connection.onAccountChange(
            pubkey,
            (accountInfo,context)=>{
                console.log(`🔔 Account ${accountPubKey.slice(0,8)}... updated at slot ${context.slot}`);
                callback(accountInfo)
            },
            "confirmed"
        )
        return subscriptionId
    }
    async unsubscribe (subscriptionId: number):Promise<void>{
        try {
            await this.connection.removeAccountChangeListener(subscriptionId)
            console.log(`🔕 Unsubscribed: ${subscriptionId}`);
        } catch (error) {
            console.error("Error unsubscribing:", error);
        }
    }
}
