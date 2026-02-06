// Helper function to format time based on resolution
export function formatTimeForResolution(timestamp: Date, resolution: string): string {
    // For daily and weekly resolutions, use 'YYYY-MM-DD' format
    if (resolution === '1d' || resolution === '1w') {
      return timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    // For intraday resolutions, we need to format as 'YYYY-MM-DD HH:MM:SS'
    // But lightweight-charts for intraday needs to use business day format
    // Let's use the date portion with time appended
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toISOString().split('T')[1].substring(0, 8);
    
    // For now, use just date for all - lightweight-charts will group by date
    return dateStr;
  }