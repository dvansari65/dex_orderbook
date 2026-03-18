"use client"

import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';
import { useSocket } from '@/providers/SocketProvider';
import CandleChartSkeleton from './ui/candle-chart-skeleton';

interface CandleData { time: string; open: number; high: number; low: number; close: number; }
interface CandleUpdate { candle: CandleData; volume: number; timestamp: string; }

const sanitizeCandles = (candles: CandleData[]): CandleData[] => {
  const deduped = Object.values(
    candles.reduce((acc, c) => { acc[c.time] = c; return acc; }, {} as Record<string, CandleData>)
  ).sort((a, b) => (a.time > b.time ? 1 : -1));

  return deduped.filter(c => {
    const isFlat = c.open === c.high && c.high === c.low && c.low === c.close;
    if (isFlat) console.warn('Filtered placeholder candle:', c);
    return !isFlat;
  });
};

export default function CandleChart() {
  const chartRef         = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef  = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [resolution, setResolution] = useState('1d');
  const socket = useSocket();

  useEffect(() => {
    if (!chartRef.current || chartInstanceRef.current || !socket) return;
    const container = chartRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: '#FAF8F6' },
        textColor: '#6F625B',
      },
      grid: {
        vertLines: { color: '#E6E4E1' },
        horzLines: { color: '#E6E4E1' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartInstanceRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    candleSeriesRef.current = candleSeries;

    const handleSnapshot = (data: any) => {
      if (!data?.candles?.candles) return;
      candleSeries.setData(sanitizeCandles(data.candles.candles));
      setTimeout(() => { chart.timeScale().fitContent() }, 50);
    };

    const handleCandleUpdate = (updateData: CandleUpdate) => {
      if (!updateData?.candle?.time) return;
      candleSeries.update(updateData.candle);
    };

    const handleResolutionRes = (data: any) => {
      if (!data?.candles?.candles) return;
      candleSeries.setData(sanitizeCandles(data.candles.candles));
      setTimeout(() => chart.timeScale().fitContent(), 50);
    };

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });

    socket.on('snapshot', handleSnapshot);
    socket.on('candle:filled', handleCandleUpdate);
    socket.on('resolution:1m', handleResolutionRes);
    socket.on('resolution:5m', handleResolutionRes);
    socket.on('resolution:1h', handleResolutionRes);
    socket.on('resolution:1d', handleResolutionRes);
    window.addEventListener('resize', handleResize);

    return () => {
      socket.off('snapshot', handleSnapshot);
      socket.off('candle:filled', handleCandleUpdate);
      socket.off('resolution:1m', handleResolutionRes);
      socket.off('resolution:5m', handleResolutionRes);
      socket.off('resolution:1h', handleResolutionRes);
      socket.off('resolution:1d', handleResolutionRes);
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current  = null;
    };
  }, [socket]);

  const handleResolution = (reso: '1m' | '5m' | '1h' | '1d') => {
    setResolution(reso);
    socket.emit('resolution', { resolution: reso });
  };

  const resolutions = ['1m', '5m', '1h', '1d'] as const;

  return (
    // ✅ chart div is ALWAYS in the DOM so chartRef.current is never null
    <div className="w-full h-full flex flex-col relative">

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-semibold text-primary">Candle Chart</span>
        <div className="flex items-center gap-3">
          {resolutions.map(r => (
            <span
              key={r}
              onClick={() => handleResolution(r)}
              className="text-xs cursor-pointer uppercase"
              style={{
                color: resolution === r ? 'var(--phoenix-accent)' : 'var(--phoenix-text-subtle)',
                fontWeight: resolution === r ? 600 : 400,
              }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <div ref={chartRef} className="w-full flex-1" />
    </div>
  );
}