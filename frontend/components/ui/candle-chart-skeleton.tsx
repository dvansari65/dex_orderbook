function CandleChartSkeleton() {
    const bars = [40, 65, 50, 80, 55, 70, 45, 75, 60, 85, 50, 65, 72, 58, 68];
    return (
      <div className="w-full h-full flex flex-col bg-[#FAF8F6] animate-pulse">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="h-3 w-24 rounded bg-[#E6E4E1]" />
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-2 w-5 rounded bg-[#E6E4E1]" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-end gap-[6px] px-6 pb-6">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-[2px]">
              <div className="w-[1px] bg-[#D1CDC9]" style={{ height: `${h * 0.25}%` }} />
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${h * 0.55}%`,
                  background: i % 2 === 0 ? 'rgba(43,138,62,0.12)' : 'rgba(224,49,49,0.12)',
                  border: `1px solid ${i % 2 === 0 ? 'rgba(43,138,62,0.2)' : 'rgba(224,49,49,0.2)'}`,
                }}
              />
              <div className="w-[1px] bg-[#D1CDC9]" style={{ height: `${h * 0.15}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  export default CandleChartSkeleton