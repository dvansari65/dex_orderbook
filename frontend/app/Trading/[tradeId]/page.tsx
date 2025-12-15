import Orderbook from "@/components/orderbook";

function Trading() {
  return (
    <div className="w-full h-screen overflow-hidden flex" style={{ background: 'var(--phoenix-bg-main)' }}>
      {/* Left Section */}
      <div className="flex flex-col flex-1">
        {/* Candle Graph */}
        <div className="flex-1 border-b" style={{ 
          background: 'var(--phoenix-bg-subtle)',
          borderColor: 'var(--phoenix-border-light)' 
        }}>
          <div className="w-full h-full flex items-center justify-center" 
               style={{ color: 'var(--phoenix-text-subtle)' }}>
            Candle Graph
          </div>
        </div>

        {/* Bottom Section - Increased height from h-64 to h-80 */}
        <div className="h-80 flex border-t" style={{ borderColor: 'var(--phoenix-border-light)' }}>
          {/* Order History */}
          <div className="flex-1 border-r" style={{ 
            background: 'var(--phoenix-bg-subtle)',
            borderColor: 'var(--phoenix-border-light)' 
          }}>
            <div className="w-full h-full flex items-center justify-center" 
                 style={{ color: 'var(--phoenix-text-subtle)' }}>
              Order History
            </div>
          </div>

          {/* Orderbook - Increased width from w-80 to w-96 */}
          <div className="w-96">
            <Orderbook />
          </div>
        </div>
      </div>

      {/* Right Section - Swap Interface */}
      <div className="w-96 h-full border-l" style={{ 
        background: 'var(--phoenix-bg-subtle)',
        borderColor: 'var(--phoenix-border-light)' 
      }}>
        <div className="w-full h-full flex items-center justify-center" 
             style={{ color: 'var(--phoenix-text-subtle)' }}>
          Swapping Interface
        </div>
      </div>
    </div>
  );
}

export default Trading;