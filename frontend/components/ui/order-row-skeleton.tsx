function OrderRowsSkeleton() {
    return (
      <div className="flex flex-col animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 items-center px-4 py-3 gap-2">
            {/* Side */}
            <div className="h-3 w-10 rounded bg-[#E6E4E1]" />
            {/* Price */}
            <div className="h-3 w-16 rounded bg-[#E6E4E1]" />
            {/* Qty */}
            <div className="h-3 w-10 rounded bg-[#E6E4E1]" />
            {/* Filled + progress */}
            <div className="flex flex-col gap-1">
              <div className="h-3 w-14 rounded bg-[#E6E4E1]" />
              <div className="h-[3px] w-14 rounded-full bg-[#E6E4E1]" />
            </div>
            {/* Status */}
            <div className="h-3 w-12 rounded bg-[#E6E4E1]" />
          </div>
        ))}
      </div>
    )
  }
export default OrderRowsSkeleton