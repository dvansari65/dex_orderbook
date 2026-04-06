"use client"

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  ColorType,
  CandlestickData,
  Time,
  BusinessDay,
} from 'lightweight-charts';
import { useSocket } from '@/providers/SocketProvider';

type Resolution = '1m' | '5m' | '1h' | '1d';
type CandleData = CandlestickData<Time>;

interface CandleUpdate {
  candles?: Partial<Record<Resolution, CandleData>>;
  volumes?: Partial<Record<Resolution, number>>;
  timestamp: string;
}

const timeKey = (time: Time): string => {
  if (typeof time === 'number') return `ts:${time}`;
  if (typeof time === 'string') return `str:${time}`;

  const businessDay = time as BusinessDay;
  return `bd:${businessDay.year}-${businessDay.month}-${businessDay.day}`;
};

const timeSortValue = (time: Time): number | string => {
  if (typeof time === 'number' || typeof time === 'string') return time;

  const businessDay = time as BusinessDay;
  return `${businessDay.year.toString().padStart(4, '0')}-${businessDay.month
    .toString()
    .padStart(2, '0')}-${businessDay.day.toString().padStart(2, '0')}`;
};

const sanitizeCandles = (candles: CandleData[]): CandleData[] => {
  const deduped = Object.values(
    candles.reduce((acc, c) => {
      acc[timeKey(c.time)] = c;
      return acc;
    }, {} as Record<string, CandleData>)
  ).sort((a, b) => {
    const left = timeSortValue(a.time);
    const right = timeSortValue(b.time);
    if (left === right) return 0;
    return left > right ? 1 : -1;
  });

  return deduped;
};

export default function CandleChart() {
  const chartRef         = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef  = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [resolution, setResolution] = useState<Resolution>('1d');
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
      const candle = updateData?.candles?.[resolution];
      if (!candle?.time) return;
      candleSeries.update(candle);
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
  }, [socket, resolution]);

  const handleResolution = (reso: '1m' | '5m' | '1h' | '1d') => {
    setResolution(reso);
    socket.emit('resolution', { resolution: reso });
  };

  const resolutions: Resolution[] = ['1m', '5m', '1h', '1d'];

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
