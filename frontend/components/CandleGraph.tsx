import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, Time, IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { useSocket } from '@/providers/SocketProvider';

interface ChartCandle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function CandleChart() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!chartRef.current) return;

    const container = chartRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      layout: {
        background: { color: '#FAF8F6' },
        textColor: '#6F625B',
      },
      grid: {
        vertLines: { color: '#E6E4E1' },
        horzLines: { color: '#E6E4E1' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#E6E4E1',
      },
      rightPriceScale: {
        borderColor: '#E6E4E1',
      },
    });

    chartInstanceRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries);
    candleSeries.applyOptions({
      upColor: '#FF7A2F',
      downColor: '#9A928C',
      borderVisible: false,
      wickUpColor: '#FF7A2F',
      wickDownColor: '#9A928C',
    });

    seriesRef.current = candleSeries;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!socket || !seriesRef.current) return;
    
    socket.on('snapshot', (data: any) => {
      console.log("snapshot:",data)
      if (!seriesRef.current) return;
      console.log("data:",data?.candles)
      const formatted: ChartCandle[] = data.candles.map((c: any) => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as Time,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }));

      seriesRef.current.setData(formatted);
      chartInstanceRef.current?.timeScale().fitContent();
    });

    return () => {
      socket.off('snapshot');
    };
  }, [socket]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-semibold" style={{ color: '#2B1B12' }}>
          Candle Chart
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs cursor-pointer" style={{ color: '#9A928C' }}>1H</span>
          <span className="text-xs cursor-pointer" style={{ color: '#9A928C' }}>4H</span>
          <span className="text-xs font-semibold cursor-pointer" style={{ color: '#FF7A2F' }}>1D</span>
          <span className="text-xs cursor-pointer" style={{ color: '#9A928C' }}>1W</span>
        </div>
      </div>
      <div ref={chartRef} className="w-full flex-1" />
    </div>
  );
}