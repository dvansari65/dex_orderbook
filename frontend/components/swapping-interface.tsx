"use client"
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

import { OrderType, PlaceOrderInputs, Side } from '@/types/slab';
import { toast } from 'sonner';
import { orderIdGenerator } from '@/lib/IdGenerator';
import { PlaceOrder } from '@/api/place-order';
import { PlacePostOnlyOrder } from '@/api/place-post-only-order';
import { PlaceIOCOrder } from '@/api/place-ioc-order';

function SwappingInterface() {
  const { connected, publicKey, signTransaction } = useWallet()
  const { setVisible } = useWalletModal()

  const [orderType, setOrderType] = useState<OrderType>({ limit: {} })
  const [side, setSide] = useState<Side>({ bid: {} })
  const [price, setPrice] = useState(0)
  const [size, setSize] = useState(0)
  const total = price && size ? (price * size).toFixed(6) : '0.00'

  const limitMutation = PlaceOrder()
  const postOnlyMutation = PlacePostOnlyOrder()
  const iocMutation = PlaceIOCOrder()

  const isLimit = 'limit' in orderType
  const isPostOnly = 'postOnly' in orderType
  const isIOC = 'immediateOrCancel' in orderType

  const activeMutation = isLimit ? limitMutation : isPostOnly ? postOnlyMutation : iocMutation
  const isPending = activeMutation.isPending

  const resetForm = () => {
    setPrice(0)
    setSize(0)
    setOrderType({ limit: {} })
    setSide({ bid: {} })
  }

  const handlePlaceOrder = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setVisible(true)
      return
    }
    if (!price || !size || isNaN(price) || isNaN(size)) {
      toast.error('Please enter price and size')
      return
    }

    const payload: PlaceOrderInputs = {
      clientOrderId: orderIdGenerator.generate(),
      maxBaseSize: size,
      price,
      side,
      orderType,
    }

    const callbacks = {
      onSuccess: (data: unknown) => {
        toast.success("Order placed successfully!")
        resetForm()
      },
      onError: (error: Error) => {
        resetForm()
        toast.error(error.message)
      },
    }

    if (isLimit) {
      limitMutation.mutate(payload, callbacks)
    } else if (isPostOnly) {
      postOnlyMutation.mutate(payload, callbacks)
    } else if (isIOC) {
      iocMutation.mutate(payload, callbacks)
    }
  }

  const isBid = 'bid' in side

  return (
    <div className="w-full h-full rounded-2xl flex flex-col p-4" style={{ background: '#FAF8F6' }}>
      <h2 className="text-base font-semibold mb-4" style={{ color: "#2B1B12" }}>
        Place Order
      </h2>

      {/* Order Type Selector */}
      <div className="mb-3">
        <label className="text-xs mb-1.5 block" style={{ color: "#6F625B" }}>
          Order Type
        </label>
        <div className="flex gap-1.5">
          <button
            onClick={() => setOrderType({ limit: {} })}
            className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: isLimit ? "#FF7A2F" : "#F4F1EE", color: isLimit ? "white" : "#6F625B" }}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderType({ postOnly: {} })}
            className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: isPostOnly ? "#FF7A2F" : "#F4F1EE", color: isPostOnly ? "white" : "#6F625B" }}
          >
            Post
          </button>
          <button
            onClick={() => setOrderType({ immediateOrCancel: {} })}
            className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: isIOC ? "#FF7A2F" : "#F4F1EE", color: isIOC ? "white" : "#6F625B" }}
          >
            IOC
          </button>
        </div>
      </div>

      {/* Side Selector */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSide({ bid: {} })}
          className="flex-1 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: isBid ? "#FF7A2F" : "rgba(255, 122, 47, 0.15)",
            color: isBid ? "white" : "#FF7A2F",
            boxShadow: isBid ? "0 4px 12px rgba(255, 122, 47, 0.3)" : "none",
          }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-sm">Buy</span>
        </button>
        <button
          onClick={() => setSide({ ask: {} })}
          className="flex-1 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: !isBid ? "#DC2626" : "rgba(220, 38, 38, 0.1)",
            color: !isBid ? "white" : "#DC2626",
            boxShadow: !isBid ? "0 4px 12px rgba(220, 38, 38, 0.3)" : "none",
          }}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span className="text-sm">Sell</span>
        </button>
      </div>

      {/* Price Input */}
      <div className="mb-3">
        <label className="text-xs mb-1.5 block" style={{ color: "#6F625B" }}>Price</label>
        <div className="rounded-lg p-2.5" style={{ background: "#F4F1EE" }}>
          <input
            type="number"
            value={String(price)}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            placeholder="0.00"
            className="bg-transparent text-sm font-medium outline-none w-full"
            style={{ color: "#2B1B12" }}
          />
        </div>
      </div>

      {/* Size Input */}
      <div className="mb-3">
        <label className="text-xs mb-1.5 block" style={{ color: "#6F625B" }}>Size</label>
        <div className="rounded-lg p-2.5" style={{ background: "#F4F1EE" }}>
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(parseFloat(e.target.value))}
            placeholder="0.00"
            className="bg-transparent text-sm font-medium outline-none w-full"
            style={{ color: "#2B1B12" }}
          />
        </div>
      </div>

      {/* Total */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6F625B" }}>
          <span>Total</span>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "#F4F1EE" }}>
          <div className="text-sm font-semibold" style={{ color: "#2B1B12" }}>{total}</div>
        </div>
      </div>

      {/* Place Order Button */}
      {!connected ? (
        <button
          onClick={() => setVisible(true)}
          className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          style={{
            background: 'linear-gradient(to right, #FF7A2F, #FF8F52)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(255, 122, 47, 0.3)',
          }}
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handlePlaceOrder}
          disabled={isPending || !price || !size}
          className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          style={{
            background: isBid
              ? 'linear-gradient(to right, #FF7A2F, #FF8F52)'
              : 'linear-gradient(to right, #DC2626, #EF4444)',
            color: 'white',
            boxShadow: isBid
              ? '0 4px 12px rgba(255, 122, 47, 0.3)'
              : '0 4px 12px rgba(220, 38, 38, 0.3)',
          }}
        >
          {isPending ? 'Placing...' : `Place ${isBid ? 'Buy' : 'Sell'} Order`}
        </button>
      )}

      {/* Connected Info */}
      {connected && publicKey && (
        <div className="mt-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(255, 122, 47, 0.15)' }}>
          <div className="flex justify-between items-center" style={{ color: '#6F625B' }}>
            <span>Connected:</span>
            <span className="font-mono font-medium" style={{ color: '#2B1B12' }}>
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SwappingInterface