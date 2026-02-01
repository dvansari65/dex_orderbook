// scripts/seedCandles.ts
import prisma from "../lib/prisma";

interface CandleInput {
  marketAddress: string;
  resolution: string;
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

function generateCandleData(
  marketAddress: string,
  resolution: string,
  count: number
): CandleInput[] {
  const candles: CandleInput[] = []; // typed array fixes the "never" error
  let price = 100;
  const now = new Date();

  const intervalMap: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };

  const interval = intervalMap[resolution];

  for (let i = count; i > 0; i--) {
    const timestamp = new Date(now.getTime() - i * interval);

    const change = (Math.random() - 0.48) * 5;
    const open = price;
    price = open + change;
    const close = price;

    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    const volume = 100 + Math.abs(change) * 50 + Math.random() * 500;

    candles.push({
      marketAddress,
      resolution,
      timestamp,
      open: open.toFixed(6),
      high: high.toFixed(6),
      low: low.toFixed(6),
      close: close.toFixed(6),
      volume: volume.toFixed(9),
    });
  }

  return candles;
}

async function seed() {
  const marketAddress = "YourMarketPubkeyHere";

  console.log("🌱 Seeding candle data...");

  await prisma.candle.deleteMany({
    where: { marketAddress },
  });

  const resolutions = ["1m", "5m", "1h", "1d"];
  const counts: Record<string, number> = {
    "1m": 500,
    "5m": 500,
    "1h": 200,
    "1d": 100,
  };

  for (const resolution of resolutions) {
    const candles = generateCandleData(marketAddress, resolution, counts[resolution]);

    await prisma.candle.createMany({
      data: candles,
      skipDuplicates: true,
    });

    // Bug fixed: was console.log`...` (tagged template) → console.log(...)
    console.log(`✅ ${resolution}: ${candles.length} candles created`);
  }

  console.log("🎉 Seeding complete!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});