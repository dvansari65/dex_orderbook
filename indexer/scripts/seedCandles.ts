// scripts/seed15Candles.ts
// Run with: npx ts-node scripts/seed15Candles.ts
import dotenv from "dotenv"
dotenv.config()

import prisma from "../lib/prisma";

const MARKET_ADDRESS = process.env.MARKET_PUBKEY || ""

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

const BASE_PRICES: Record<string, number> = {
  "1m": 42.5,
  "5m": 120.8,
  "1h": 380.0,
  "1d": 1250.0,
};

function seed15Candles(resolution: string) {
  const candles = [];
  const now = Date.now();
  const interval = INTERVAL_MS[resolution];
  let price = BASE_PRICES[resolution];

  // Start 15 bars back so the last candle lands at ~now
  const startTime = now - 15 * interval;

  for (let i = 0; i < 15; i++) {
    const timestamp = new Date(startTime + i * interval);

    const open = price;
    // Small realistic move per bar
    const change = open * (Math.random() * 0.03 - 0.015); // ±1.5%
    const close = open + change;

    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low  = Math.min(open, close) * (1 - Math.random() * 0.008);

    const volume = 1000 + Math.abs(change / open) * 50_000 + Math.random() * 500;

    candles.push({
      marketAddress: MARKET_ADDRESS,
      resolution,
      timestamp,
      open:   open.toFixed(9),
      high:   high.toFixed(9),
      low:    low.toFixed(9),
      close:  close.toFixed(9),
      volume: volume.toFixed(9),
    });

    price = close; // next bar opens where this one closed
  }

  return candles;
}

async function main() {
  console.log("🌱 Seeding 15 candles per resolution...\n");

  const resolutions = ["1m", "5m", "1h", "1d"];

  for (const resolution of resolutions) {
    const candles = seed15Candles(resolution);

    await prisma.candle.createMany({
      data: candles,
      skipDuplicates: true,
    });

    console.log(`✅ [${resolution}] 15 candles inserted`);
    candles.forEach((c, i) => {
      console.log(
        `   #${String(i + 1).padStart(2, "0")} | ${c.timestamp.toISOString()} | ` +
        `O:${Number(c.open).toFixed(3)}  H:${Number(c.high).toFixed(3)}  ` +
        `L:${Number(c.low).toFixed(3)}  C:${Number(c.close).toFixed(3)}  ` +
        `V:${Number(c.volume).toFixed(0)}`
      );
    });
    console.log();
  }

  console.log("🎉 Done! 60 candles total (15 × 4 resolutions)");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());