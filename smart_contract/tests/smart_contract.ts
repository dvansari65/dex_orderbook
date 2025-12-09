import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Orderbook } from "../target/types/orderbook";

describe("smart_contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.smartContract as Program<Orderbook>;

  it("Is initialized!", async () => {
    // Add your test here.
    // const tx = await program.methods.().rpc();
    // console.log("Your transaction signature", tx);
  });
});
