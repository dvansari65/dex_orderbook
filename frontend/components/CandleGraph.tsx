import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  ColorType,
  AreaSeries
} from 'lightweight-charts';
import { useSocket } from '@/providers/SocketProvider';

// Types for our data
interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: string;
  value: number;
}

interface SnapshotData {
  candles: CandleData[];
  volumeData: VolumeData[];
}

interface CandleUpdate {
  candle: CandleData;
  volume: number;
  timestamp: string;
}

export default function CandleChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [resolution, setResolution] = useState('1d');
  const socket = useSocket();

  useEffect(() => {
    if (!chartRef.current || chartInstanceRef.current || !socket) return;

    const container = chartRef.current;
    
    // Create chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#FAF8F6' },
        textColor: '#6F625B',
      },
      grid: {
        vertLines: { color: '#E6E4E1' },
        horzLines: { color: '#E6E4E1' },
      },
      timeScale:{
        timeVisible: true,  
        secondsVisible:false
      }
    });

    chartInstanceRef.current = chart;

    // Create candlestick series (price)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', 
      downColor: '#ef5350', 
      borderVisible: false,
      wickUpColor: '#26a69a', 
      wickDownColor: '#ef5350',
    });

    // Create volume area series
    const volumeSeries = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(0, 150, 136, 0.8)',
      topColor: 'rgba(0, 150, 136, 0.3)',
      bottomColor: 'rgba(0, 150, 136, 0)',
      priceFormat: {
        type: 'volume',
      }
    });

    // Position volume at bottom (20% of chart height)
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.2,   // Price scale uses top 20%
        bottom: 0.2 // Price scale uses bottom 20%
      }
    });

    // Store refs for later use
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle snapshot data (initial load)
    const handleSnapshot = (data: { candles: SnapshotData }) => {
      console.log("Candle snapshot data:", data);
      
      if (!data?.candles) {
        console.error("No candle data in snapshot");
        return;
      }
      console.log("candles:",data.candles.candles)
      // Set candlestick data
      if (data.candles.candles && Array.isArray(data.candles.candles)) {
        candleSeries.setData(data.candles.candles);
      }

      // Fit content after data is set
      setTimeout(() => {
        chart.timeScale().fitContent();
      }, 50);
    };

    // Handle real-time candle updates
    const handleCandleUpdate = (updateData: CandleUpdate) => {
      console.log("Candle update:", updateData);
      
      if (!updateData?.candle || !updateData.candle.time) {
        console.error("Invalid candle update data");
        return;
      }
      // Update candlestick
      candleSeries.update(updateData.candle);
      
      // Update volume
      volumeSeries.update({
        time: updateData.candle.time,
        value: updateData.volume
      });
    };

    // Handle window resize
    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: container.clientWidth
        });
      }
    };

    const handleResolutionRes = (data: any) => {
      console.log("resolution response:", data);
      
      if (data?.candles?.candles) {
        candleSeries.setData(data.candles.candles);
      }
      
      if (data?.candles?.volumeData) {
        volumeSeries.setData(data.candles.volumeData);
      }
      
      // Fit content after data is set
      setTimeout(() => {
        chart.timeScale().fitContent();
      }, 50);
    };
  
    // Add event listeners
    socket.on("snapshot", handleSnapshot);
    socket.on("candle:filled", handleCandleUpdate);
    socket.on(`resolution:${resolution}`,handleResolutionRes)
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      socket.off("snapshot", handleSnapshot);
      socket.off("candle:filled", handleCandleUpdate);
      window.removeEventListener('resize', handleResize);
      
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [socket]);
  const handleResolution = (reso:"1d" | "1w" | "1h" | "4h")=>{
    switch (reso) {
      case "1d":
        setResolution("1d")
        break;
      case "1h":
        setResolution("1h")
        break;
      case "1w":
        setResolution("1w")
        break;
      case "4h":
        setResolution("4h")
        break;
      default:
        setResolution("1h")
        break;
    }
    socket.emit("resolution",resolution)
  }
  // Request new data when resolution changes
  useEffect(() => {
    if (socket) {
      socket.emit('request:candles', { resolution });
    }
  }, [resolution, socket]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-semibold" style={{ color: '#2B1B12' }}>
          Candle Chart
        </span>
        <div className="flex items-center gap-3">
          <span 
            onClick={() => handleResolution('1h')}
            className="text-xs cursor-pointer" 
            style={{ color: resolution === '1h' ? '#FF7A2F' : '#9A928C', fontWeight: resolution === '1h' ? 600 : 400 }}
          >
            1H
          </span>
          <span 
            onClick={() => handleResolution('4h')}
            className="text-xs cursor-pointer" 
            style={{ color: resolution === '4h' ? '#FF7A2F' : '#9A928C', fontWeight: resolution === '4h' ? 600 : 400 }}
          >
            4H
          </span>
          <span 
            onClick={() => handleResolution('1d')}
            className="text-xs cursor-pointer" 
            style={{ color: resolution === '1d' ? '#FF7A2F' : '#9A928C', fontWeight: resolution === '1d' ? 600 : 400 }}
          >
            1D
          </span>
          <span 
            onClick={() => handleResolution('1w')}
            className="text-xs cursor-pointer" 
            style={{ color: resolution === '1w' ? '#FF7A2F' : '#9A928C', fontWeight: resolution === '1w' ? 600 : 400 }}
          >
            1W
          </span>
        </div>
      </div>
      <div 
        ref={chartRef} 
        className="w-full flex-1" 
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}