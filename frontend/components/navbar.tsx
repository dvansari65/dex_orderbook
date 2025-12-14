"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid"
import { toast } from "sonner"
function Navbar() {
  const router = useRouter()
  const tradeId = uuid()
  const startTrading = () => {

    if (!tradeId) {
      toast.error("Trade ID not found!")
      return;
    }
    router.push(`/Trading/${tradeId as string}`)
  }
  return (
    <nav
      className="
        fixed top-6 left-1/2 -translate-x-1/2
        z-50
        w-full
        flex justify-center
        pointer-events-none
      "
    >
      {/* NAV CONTAINER */}
      <div
        className="
          pointer-events-auto
          w-[92%] max-w-[1200px]
          h-[72px]

          bg-[#F7F6F4]/70
          backdrop-blur-xl
          backdrop-saturate-150

          border border-white/40
          rounded-full

          shadow-[0_8px_30px_rgba(0,0,0,0.05)]

          flex items-center
          px-6
        "
      >
        {/* LEFT: LOGO */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#2B1B12] rotate-45 rounded-sm" />
          <span className="text-[#2B1B12] font-semibold tracking-wide">
            PHOENIX
          </span>
        </div>

        {/* CENTER: NAV LINKS */}
        <div className="flex-1 flex justify-center">
          <div className="flex gap-10 text-[#2B1B12] font-medium">
            <button className="flex items-center gap-1 hover:opacity-80 transition">
              Developers
              <ChevronDown size={16} />
            </button>

            <button className="flex items-center gap-1 hover:opacity-80 transition">
              Community
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        {/* RIGHT: CTA */}
        <button
          onClick={startTrading}
          className="
            bg-[#FF7A2F]
            text-white
            px-6
            py-2.5
            rounded-full
            font-medium
            hover:bg-[#FF8F52]
            transition
            shadow-sm
          "
        >
          Start trading
        </button>
      </div>
    </nav>
  );
}

export default Navbar