"use client"
import Navbar from "@/components/navbar";
import { useSocket } from "@/providers/SocketProvider";
import { useEffect } from "react";

export default function Home() {
  const socket = useSocket()
  useEffect(() => {
    socket.on("market-state", (data: any) => {
      console.log("market state:", data)
    })
  }, [socket])
  return (
    <div className="overflow-y-auto">
      <Navbar />
      <section className="w-full flex justify-center pt-32 pb-36">
        <div className="w-[92%] max-w-[900px] text-center">
          {/* HEADING */}
          <h1
            className="
            text-[48px]
            sm:text-[64px]
            leading-[1.1]
            font-medium
            text-[#2B1B12]
          "
          >
            The fastest on-chain
            <br />
            orderbook in DeFi
          </h1>

          {/* SUBTEXT */}
          <p
            className="
            mt-6
            text-[18px]
            leading-relaxed
            text-[#6F625B]
          "
          >
            Meet the new standard for trading in DeFi. Place limit orders
            <br />
            with unparalleled speed, efficiency, and transparency.
          </p>

          {/* CTA BUTTON */}
          <div className="mt-10 flex justify-center">
            <button
              className="
              bg-[#FF7A2F]
              text-white
              px-8
              py-4
              rounded-full
              text-[16px]
              font-medium
              hover:bg-[#FF8F52]
              transition
              shadow-sm
            "
            >
              Launch app
            </button>
          </div>
        </div>
      </section>
      <section className="w-full flex justify-center pb-10 md:pb-20 lg:pb-40 px-4 sm:px-8 lg:pl-15">
        <div className="w-full max-w-[1200px]">
          {/* TOP LABEL */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF7A2F]/10">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#FF7A2F]"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[#FF7A2F] text-sm font-medium">
                Low cost
              </span>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="w-full flex flex-col items-start">
            {/* LEFT TEXT */}
            <div className="w-full flex flex-col items-start justify-center mb-8 lg:mb-5">
              <h2 className="text-[32px] sm:text-[42px] md:text-[50px] lg:text-[60px] leading-[1.15] font-medium text-[#2B1B12]">
                The future of DeFi is fast, cheap, and efficient.
              </h2>

              <p className="mt-2 sm:mt-1 text-[16px] sm:text-[18px] lg:text-[20px] text-[#6F625B] leading-relaxed">
                Supercharge your trading experience on a high-performance
                network with ultra-low fees.
              </p>
            </div>

            {/* RIGHT STATS */}
            <div className="w-full lg:w-[80%] flex flex-col sm:flex-row gap-8 sm:gap-4 md:gap-8 lg:gap-0 sm:justify-between sm:items-center mt-8 lg:mt-5">
              <div className="flex flex-col items-center sm:items-center lg:items-start">
                <p className="text-[#6F625B] text-sm text-center sm:text-left">
                  Protocol fees as low as
                </p>
                <p className="text-[#2B1B12] text-[36px] sm:text-[52px] md:text-[56px] lg:text-[60px] font-medium text-center sm:text-left">
                  0.02%
                </p>
                <p className="text-[#9A928C] text-sm text-center sm:text-left">
                  Per trade
                </p>
              </div>

              <div className="flex flex-col items-center sm:items-center lg:items-start">
                <p className="text-[#6F625B] text-sm text-center sm:text-left">
                  Network fees
                </p>
                <p className="text-[#2B1B12] text-[36px] sm:text-[52px] md:text-[56px] lg:text-[60px] font-medium text-center sm:text-left">
                  $0.0002
                </p>
                <p className="text-[#9A928C] text-sm text-center sm:text-left">
                  Per transaction
                </p>
              </div>

              <div className="flex flex-col items-center sm:items-center lg:items-start">
                <p className="text-[#6F625B] text-sm text-center sm:text-left">
                  Average block time
                </p>
                <p className="text-[#2B1B12] text-[36px] sm:text-[52px] md:text-[56px] lg:text-[60px] font-medium text-center sm:text-left">
                  0.5 sec
                </p>
                <p className="text-[#6F625B] text-sm text-center sm:text-left">
                  Only on Solana
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full flex justify-center pb-40">
        <div className="w-[92%] max-w-[1200px]">
          {/* TOP SECTION WITH LABEL */}
          <div className="flex items-center gap-2 mb-12">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF7A2F]/10 border border-[#FF7A2F]/20">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#FF7A2F]"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[#FF7A2F] text-sm font-medium tracking-wide">
                Fully on-chain
              </span>
            </div>
          </div>

          {/* MAIN CONTENT - TEXT LEFT, FEATURES RIGHT */}
          <div className="w-full flex flex-col lg:flex-row items-start gap-16">
            {/* LEFT TEXT CONTENT */}
            <div className="w-full lg:w-1/2 flex flex-col items-start justify-center">
              <h2 className="text-[52px] lg:text-[60px] leading-[1.15] font-medium text-[#2B1B12]">
                A fully on-chain DEX
                <br />
                with transparency at
                <br />
                its core.
              </h2>

              <p className="mt-5 text-[18px] lg:text-[20px] text-[#6F625B] leading-relaxed max-w-[500px]">
                Experience true decentralization with no compromises. Every
                trade, every order, every settlement—fully transparent and
                verifiable on the blockchain.
              </p>
            </div>

            {/* RIGHT FEATURES GRID */}
            <div className="w-full lg:w-1/2 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Feature 1 - Non-custodial */}
              <div className="flex flex-col items-start p-6 rounded-2xl bg-[#F4F1EE] border border-[#E6E4E1] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div className="mb-4 p-2.5 rounded-xl bg-[#FF7A2F]/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-[#FF7A2F]"
                  >
                    <path
                      d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-[22px] font-medium text-[#2B1B12] mb-2">
                  Non-custodial
                </h3>
                <p className="text-[16px] text-[#6F625B] leading-relaxed">
                  Maintain total control of your assets. Your private keys
                  remain private.
                </p>
              </div>

              {/* Feature 2 - Trustless */}
              <div className="flex flex-col items-start p-6 rounded-2xl bg-[#F4F1EE] border border-[#E6E4E1] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div className="mb-4 p-2.5 rounded-xl bg-[#FF7A2F]/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-[#FF7A2F]"
                  >
                    <path
                      d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-[22px] font-medium text-[#2B1B12] mb-2">
                  Trustless
                </h3>
                <p className="text-[16px] text-[#6F625B] leading-relaxed">
                  Genuine peer-to-peer trades. Full autonomy and control—no
                  middleman involved.
                </p>
              </div>

              {/* Feature 3 - Verified code */}
              <div className="flex flex-col items-start p-6 rounded-2xl bg-[#F4F1EE] border border-[#E6E4E1] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div className="mb-4 p-2.5 rounded-xl bg-[#FF7A2F]/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-[#FF7A2F]"
                  >
                    <path
                      d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V8L14 2ZM16 16H8V14H16V16ZM16 12H8V10H16V12ZM13 9V3.5L18.5 9H13Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-[22px] font-medium text-[#2B1B12] mb-2">
                  Verified code
                </h3>
                <p className="text-[16px] text-[#6F625B] leading-relaxed">
                  Decentralized, through and through. Open-source code that
                  anyone can audit, anytime.
                </p>
              </div>

              {/* Feature 4 - Future placeholder (optional) */}
              <div className="flex flex-col items-start p-6 rounded-2xl bg-[#F4F1EE] border border-[#E6E4E1] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div className="mb-4 p-2.5 rounded-xl bg-[#FF7A2F]/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-[#FF7A2F]"
                  >
                    <path
                      d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-[22px] font-medium text-[#2B1B12] mb-2">
                  Limit orders
                </h3>
                <p className="text-[16px] text-[#6F625B] leading-relaxed">
                  Advanced order types with institutional-grade execution on
                  Solana.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full flex justify-center py-40 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#FF7A2F] rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[#FF7A2F] rounded-full blur-[100px]"></div>
          {/* Subtle grid lines */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
        linear-gradient(to right, #E6E4E1 1px, transparent 1px),
        linear-gradient(to bottom, #E6E4E1 1px, transparent 1px)
      `,
              backgroundSize: "50px 50px",
            }}
          ></div>
        </div>

        <div className="w-[92%] max-w-[900px] text-center relative z-10">
          {/* Top Label */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF7A2F]/10 border border-[#FF7A2F]/20">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#FF7A2F]"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[#FF7A2F] text-sm font-medium tracking-wide">
                Ready to trade
              </span>
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-[52px] lg:text-[60px] leading-[1.15] font-medium text-[#2B1B12] mb-6">
            Start trading on
            <br />
            Phoenix today
          </h2>

          {/* Description */}
          <p className="text-[18px] lg:text-[20px] text-[#6F625B] leading-relaxed max-w-[600px] mx-auto mb-12">
            Join thousands of traders experiencing the fastest on-chain
            orderbook. Low fees, high speed, and complete transparency await.
          </p>

          {/* Buttons Container */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA Button - Launch App */}
            <button
              className="
        group
        relative
        bg-[#FF7A2F]
        text-white
        px-8
        py-4
        rounded-full
        text-[16px]
        font-medium
        hover:bg-[#FF8F52]
        transition-all
        duration-300
        shadow-sm
        hover:shadow-md
        hover:shadow-[#FF7A2F]/20
        flex
        items-center
        justify-center
        gap-2
        min-w-[180px]
      "
            >
              <span>Launch app</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                <path
                  d="M13.75 6.75L19.25 12L13.75 17.25M19 12H4.75"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Secondary CTA Button - Join Discord */}
            <button
              className="
        group
        relative
        bg-white/80
        backdrop-blur-sm
        text-[#2B1B12]
        px-8
        py-4
        rounded-full
        text-[16px]
        font-medium
        border
        border-[#E6E4E1]
        hover:bg-white
        hover:border-[#D4D0CC]
        transition-all
        duration-300
        shadow-sm
        hover:shadow-md
        flex
        items-center
        justify-center
        gap-2
        min-w-[180px]
      "
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#5865F2]"
              >
                <path
                  d="M18.59 5.89C17.36 5.25 16.05 4.77 14.68 4.48C14.56 4.45 14.44 4.48 14.35 4.57C13.93 5 13.6 5.5 13.37 6.05C11.99 5.84 10.62 5.84 9.25 6.05C9.02 5.5 8.69 5 8.27 4.57C8.18 4.48 8.06 4.45 7.94 4.48C6.57 4.77 5.26 5.25 4.03 5.89C2.03 9.45 1.5 12.96 1.91 16.42C2.92 17.2 4.03 17.82 5.22 18.26C5.46 18.36 5.71 18.46 5.96 18.54C5.65 18.88 5.27 19.17 4.84 19.39C4.63 19.5 4.4 19.57 4.16 19.6C3.92 19.63 3.68 19.62 3.45 19.57C3.31 19.54 3.18 19.49 3.07 19.42C2.96 19.35 2.87 19.25 2.81 19.14C2.75 19.03 2.72 18.9 2.72 18.77V18.74C2.72 18.71 2.73 18.69 2.74 18.66C3.86 17.8 4.8 16.75 5.5 15.57C4.4 14.94 3.42 14.13 2.59 13.17C2.53 13.1 2.5 13 2.5 12.9C2.5 12.8 2.53 12.7 2.59 12.63C4.05 11.04 5.89 9.87 7.94 9.22C8.06 9.18 8.19 9.18 8.31 9.22C8.43 9.26 8.53 9.34 8.59 9.45C9.07 10.33 9.69 11.13 10.42 11.82C11.15 12.51 12 13.08 12.92 13.5C13.84 13.92 14.83 14.19 15.85 14.29C16.87 14.39 17.9 14.32 18.9 14.08C19.9 13.84 20.85 13.44 21.72 12.89C21.81 12.82 21.92 12.79 22.03 12.81C22.14 12.83 22.24 12.9 22.3 12.99C22.36 13.08 22.38 13.19 22.35 13.29C21.52 14.25 20.54 15.06 19.44 15.69C20.14 16.87 21.08 17.92 22.2 18.78C22.21 18.81 22.22 18.83 22.22 18.86V18.89C22.22 19.02 22.19 19.15 22.13 19.26C22.07 19.37 21.98 19.47 21.87 19.54C21.76 19.61 21.63 19.66 21.49 19.69C21.26 19.74 21.02 19.75 20.78 19.72C20.54 19.69 20.31 19.62 20.1 19.51C19.67 19.29 19.29 19 18.98 18.66C19.23 18.58 19.48 18.48 19.72 18.38C20.91 17.94 22.02 17.32 23.03 16.54C23.44 13.08 22.91 9.57 20.91 6.01C20.91 6.01 20.91 6.01 20.91 6.01L18.59 5.89Z"
                  fill="currentColor"
                />
              </svg>
              <span>Join the Discord</span>
            </button>
          </div>

          {/* Stats Footer - Subtle stats at bottom */}
          <div className="mt-16 pt-8 border-t border-[#E6E4E1]/50">
            <div className="flex flex-wrap justify-center items-center gap-8 text-[#9A928C] text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>24/7 live support</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-[#E6E4E1]"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>100% uptime</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-[#E6E4E1]"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span>No downtime</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
