function OrderbookSkeleton() {
    return (
      <div className="w-full h-full rounded-2xl bg-[#FAF8F6] flex flex-col animate-pulse">
        <div className="px-3 py-2">
          <div className="h-3 w-20 rounded bg-[#E6E4E1]" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-3 py-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-2 rounded bg-[#E6E4E1]" />
          ))}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden px-3 gap-1 justify-end pb-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-4 rounded bg-[rgba(224,49,49,0.08)]" style={{ width: `${55 + i * 4}%` }} />
              <div className="h-4 rounded bg-[#E6E4E1] flex-1" />
            </div>
          ))}
        </div>
        <div className="px-3 py-1 bg-[#F4F1EE]">
          <div className="h-2 w-24 rounded bg-[#E6E4E1]" />
        </div>
        <div className="flex-1 overflow-hidden px-3 gap-1 flex flex-col pt-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-4 rounded bg-[rgba(43,138,62,0.08)]" style={{ width: `${55 + i * 3}%` }} />
              <div className="h-4 rounded bg-[#E6E4E1] flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  export default OrderbookSkeleton