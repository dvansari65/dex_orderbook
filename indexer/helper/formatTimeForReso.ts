export type ChartTime = string | number;

// lightweight-charts expects:
// - business day strings (YYYY-MM-DD) for daily data
// - unix timestamps in seconds for intraday data
export function formatTimeForResolution(timestamp: Date, resolution: string): ChartTime {
  if (resolution === "1d" || resolution === "1w") {
    return timestamp.toISOString().split("T")[0];
  }

  return Math.floor(timestamp.getTime() / 1000);
}
