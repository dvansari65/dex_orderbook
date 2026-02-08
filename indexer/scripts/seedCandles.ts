// scripts/seedMoreCandles.ts
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

function generateMoreCandles(
  marketAddress: string,
  resolution: string,
  count: number
): CandleInput[] {
  const candles: CandleInput[] = [];
  let price = 100;
  const now = new Date();
  
  // Different base prices for different resolutions to create variety
  if (resolution === '1d') price = 100;
  if (resolution === '1h') price = 150;
  if (resolution === '5m') price = 120;
  if (resolution === '1m') price = 80;
  
  const intervalMap: Record<string, number> = {
    "1m": 60 * 1000,       // 1 minute
    "5m": 5 * 60 * 1000,   // 5 minutes
    "1h": 60 * 60 * 1000,  // 1 hour
    "1d": 24 * 60 * 60 * 1000, // 1 day
  };
  
  const interval = intervalMap[resolution];
  
  // Start from further back in time to get more historical data
  const startDaysBack = resolution === '1d' ? 365 :  // 1 year for daily
                       resolution === '1h' ? 90 :    // 3 months for hourly
                       resolution === '5m' ? 30 :    // 1 month for 5-min
                       7;                            // 1 week for 1-min
  
  const startTime = new Date(now.getTime() - (startDaysBack * 24 * 60 * 60 * 1000));
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * interval);
    
    // Create realistic market movements
    const trend = Math.sin(i / 50) * 20; // Long-term cycles
    const volatility = 5 + Math.random() * 10;
    
    const change = (Math.random() - 0.5) * volatility + trend * 0.1;
    const open = price;
    price = open + change;
    const close = price;
    
    // Realistic high/low based on trend direction
    const direction = change >= 0 ? 1 : -1;
    const high = Math.max(open, close) + Math.random() * volatility * (1 + direction);
    const low = Math.min(open, close) - Math.random() * volatility * (1 - direction);
    
    // Volume that correlates with volatility and has some randomness
    const volume = 100 + Math.abs(change) * 20 + Math.random() * 200;
    
    candles.push({
      marketAddress,
      resolution,
      timestamp,
      open: open.toFixed(9),
      high: high.toFixed(9),
      low: low.toFixed(9),
      close: close.toFixed(9),
      volume: volume.toFixed(9),
    });
    
    // Occasionally add market events (spikes/crashes)
    if (i % 50 === 0 && Math.random() > 0.7) {
      const eventChange = (Math.random() - 0.5) * 50;
      price += eventChange;
    }
  }
  
  return candles;
}

async function seed() {
  const marketAddress = "BJSsDy6feuTV1hEcrSuBwp2wGGEVndGTMfPPdMdWrPJg";

  console.log("🌱 Seeding MORE candle data...");

  // Clear existing data for this market
  await prisma.candle.deleteMany({
    where: { marketAddress },
  });

  // Generate more data points for each resolution
  const resolutions = ["1m", "5m", "1h", "1d"];
  const counts: Record<string, number> = {
    "1m": 10000,   // 10,000 minutes (~7 days worth)
    "5m": 5000,    // 5,000 * 5 minutes (~17 days)
    "1h": 2000,    // 2,000 hours (~83 days)
    "1d": 500,     // 500 days (~1.5 years)
  };

  for (const resolution of resolutions) {
    console.log(`\n📊 Generating ${resolution} candles (${counts[resolution]} candles)...`);
    
    const candles = generateMoreCandles(marketAddress, resolution, counts[resolution]);
    
    // Insert in larger batches for speed
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < candles.length; i += batchSize) {
      const batch = candles.slice(i, i + batchSize);
      
      await prisma.candle.createMany({
        data: batch,
        skipDuplicates: true,
      });
      
      inserted += batch.length;
      process.stdout.write(`\r${inserted}/${candles.length} inserted`);
    }
    
    console.log(`\n✅ ${resolution}: ${candles.length} candles created`);
    
    // Verify the data was inserted
    const countInDb = await prisma.candle.count({
      where: { marketAddress, resolution }
    });
    console.log(`   📋 ${countInDb} candles in database for ${resolution}`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("\n📈 Data Summary:");
  console.log("- 1m: 10,000 candles (~7 days of 1-minute data)");
  console.log("- 5m: 5,000 candles (~17 days of 5-minute data)");
  console.log("- 1h: 2,000 candles (~83 days of hourly data)");
  console.log("- 1d: 500 candles (~1.5 years of daily data)");
  console.log("\nYour chart should now show plenty of historical data!");
}

seed().catch((e) => {
  console.error("❌ Seeding error:", e);
  process.exit(1);
});