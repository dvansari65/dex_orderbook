"use client"
import { useWallet } from "@solana/wallet-adapter-react"
import { Order } from "@/types/order"
import OrderRowsSkeleton from "./ui/order-row-skeleton"

const statusConfig: Record<string, { label: string; color: string }> = {
  open:      { label: 'Open',      color: 'text-bid'        },
  partial:   { label: 'Partial',   color: 'text-orange-500' },
  filled:    { label: 'Filled',    color: 'text-accent'     },
  cancelled: { label: 'Cancelled', color: 'text-subtle'     },
}

const OrderRows = ({ orders, isLoading }: { orders: Order[]; isLoading?: boolean }) => {
  const { publicKey } = useWallet()

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-[12px] font-semibold text-primary">Connect your wallet</span>
      </div>
    )
  }

  if (isLoading) return <OrderRowsSkeleton />

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-[12px] font-semibold text-primary">No orders yet</span>
        <span className="text-[11px] text-subtle">Place your first order to get started</span>
      </div>
    )
  }

  return (
    <>
      {orders.map(order => {
        const pct = Math.min(100, Math.round((order.filled / order.quantity) * 100))
        const s   = statusConfig[order.status]

        return (
          <div
            key={order.orderId}
            className="grid grid-cols-5 items-center px-4 py-3 hover:bg-subtle transition-colors duration-100"
          >
            <span className={`text-[11px] font-bold tracking-wide ${order.side === 'bid' ? 'text-bid' : 'text-ask'}`}>
              {order.side === 'bid' ? '▲ BUY' : '▼ SELL'}
            </span>
            <span className="text-[12px] font-semibold text-primary tabular-nums">
              ${order.price.toFixed(2)}
            </span>
            <span className="text-[12px] text-secondary tabular-nums">
              {order?.quantity}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-secondary tabular-nums">
                {order.filled}
                <span className="text-subtle">/{order.quantity}</span>
              </span>
              <div className="h-[3px] w-14 rounded-full border-light overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? 'var(--phoenix-accent)' : 'linear-gradient(90deg,#FF7A2F,#FFB347)',
                  }}
                />
              </div>
            </div>
            <span className={`text-[11px] font-semibold ${s.color}`}>{s.label}</span>
          </div>
        )
      })}
    </>
  )
}

export default OrderRows