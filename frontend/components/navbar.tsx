"use client";
import { ChevronDown, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

function Navbar() {
  const router = useRouter();
  const tradeId = uuid();
  const [menuOpen, setMenuOpen] = useState(false);

  const startTrading = () => {
    if (!tradeId) {
      toast.error("Trade ID not found!");
      return;
    }
    router.push(`/Trading`);
  };

  return (
    <>
      <nav
        className="
          fixed top-6 left-1/2 -translate-x-1/2
          z-50
          w-full
          flex justify-center
          pointer-events-none
        "
      >
        <div
          className="
            pointer-events-auto
            w-[92%] max-w-[1200px]
            h-[72px] sm:h-[72px] h-[56px]
            bg-[#F7F6F4]/70
            backdrop-blur-xl
            backdrop-saturate-150
            border border-white/40
            rounded-full
            shadow-[0_8px_30px_rgba(0,0,0,0.05)]
            flex items-center
            px-6 sm:px-6 px-4
          "
        >
          {/* LEFT: LOGO */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-[#2B1B12] rotate-45 rounded-sm flex-shrink-0" />
            <span className="text-[#2B1B12] font-semibold tracking-wide text-sm sm:text-base">
              VELOX
            </span>
          </div>

          {/* CENTER: NAV LINKS — desktop only */}
          <div className="flex-1 flex justify-center">
            <div className="hidden sm:flex gap-10 text-[#2B1B12] font-medium">
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

          {/* RIGHT: CTA + Hamburger */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={startTrading}
              className="
                bg-[#FF7A2F]
                text-white
                px-4 py-2 text-sm
                sm:px-6 sm:py-2.5 sm:text-base
                rounded-full
                font-medium
                hover:bg-[#FF8F52]
                transition
                shadow-sm
              "
            >
              Start trading
            </button>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="
                sm:hidden
                w-8 h-8
                flex items-center justify-center
                rounded-full
                bg-[#2B1B12]/8
                hover:bg-[#2B1B12]/15
                transition
                text-[#2B1B12]
              "
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* MOBILE DROPDOWN */}
        {menuOpen && (
          <div
            className="
              pointer-events-auto
              sm:hidden
              absolute top-[72px]
              w-[92%]
              bg-[#F7F6F4]/90
              backdrop-blur-xl
              border border-white/40
              rounded-2xl
              shadow-[0_8px_30px_rgba(0,0,0,0.08)]
              overflow-hidden
              mt-2
            "
          >
            <button className="
              w-full flex items-center justify-between
              px-6 py-4
              text-[#2B1B12] font-medium text-sm
              hover:bg-[#2B1B12]/5 transition
              border-b border-[#2B1B12]/8
            ">
              Developers
              <ChevronDown size={15} />
            </button>
            <button className="
              w-full flex items-center justify-between
              px-6 py-4
              text-[#2B1B12] font-medium text-sm
              hover:bg-[#2B1B12]/5 transition
            ">
              Community
              <ChevronDown size={15} />
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

export default Navbar;
