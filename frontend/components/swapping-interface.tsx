"use client"
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import React, { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { placeOrder } from '@/api/place-order';
import {  OrderType, PlaceOrderInputs, Side } from '@/types/slab';
import { toast } from 'sonner';
import { orderIdGenerator } from '@/lib/IdGenerator';
import { OpenOrderModal } from './open-order/Initialise-open-order';

function SwappingInterface() {
  const { connected, publicKey, signTransaction } = useWallet()
  const { setVisible } = useWalletModal()
  
  const [orderType, setOrderType] = useState<OrderType>({ limit: {} })
  const [side, setSide] = useState<Side>({ bid: {} })
  const [price, setPrice] = useState(0)
  const [size, setSize] = useState(0)
  const [showOpenOrderModal, setShowOpenOrderModal] = useState(false) // ✅ Add state for modal
 
   // Calculate total
  const total = price && size ? ((price) * (size)).toFixed(6) : '0.00'

  const { mutate, isPending, error } = placeOrder()

  const clientOrderId = orderIdGenerator.generate();
  
  const handlePlaceOrder = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setVisible(true)
      return
    }
    if (!price || !size) {
      alert('Please enter price and size')
      return
    }
    const payload: PlaceOrderInputs = {
      clientOrderId: clientOrderId,
      maxBaseSize: size,
      price: price,
      side: side,
      orderType
    }
    console.log("payload:", payload)
    mutate(payload, {
      onSuccess: (data) => {
        console.log("data order placed:", data)
        toast.success("Order placed successfully!")
      },
      onError: (error) => {
        console.log("error:", error.message)
        
        // ✅ Check if it's an open order initialization error
        if (
          error.message.includes("account: open_order") && 
          error.message.includes("Error Code: AccountNotInitialized")
        ) {
          setShowOpenOrderModal(true) // ✅ Show modal
          toast.error("Please initialize your open order account first")
        } else {
          toast.error(error.message)
        }
      }
    })
    
  }

  const isBid = 'bid' in side;
  const isLimit = 'limit' in orderType;
  const isPostOnly = 'postOnly' in orderType;
  const isIOC = 'immediateOrCancel' in orderType;

  // ✅ Check if error is open order not initialized
  const needsOpenOrderInit = error && 
    error.message.includes("account: open_order") && 
    error.message.includes("Error Code: AccountNotInitialized");

  return (
    <div className="w-96 h-full rounded-2xl flex flex-col p-6" style={{ 
      background: '#FAF8F6',
    }}>
      <h2 className="text-xl font-semibold mb-6" style={{ color: "#2B1B12" }}>
    Place Order
  </h2>

  {/* Order Type Selector */}
  <div className="mb-4">
    <label className="text-sm mb-2 block" style={{ color: "#6F625B" }}>
      Order Type
    </label>
    <div className="flex gap-2">
      <button
        onClick={() => setOrderType({ limit: {} })}
        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: isLimit ? "#FF7A2F" : "#F4F1EE",
          color: isLimit ? "white" : "#6F625B",
        }}
      >
        Limit
      </button>
      <button
        onClick={() => setOrderType({ postOnly: {} })}
        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: isPostOnly ? "#FF7A2F" : "#F4F1EE",
          color: isPostOnly ? "white" : "#6F625B",
        }}
      >
        Post
      </button>
      <button
        onClick={() => setOrderType({ immediateOrCancel: {} })}
        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: isIOC ? "#FF7A2F" : "#F4F1EE",
          color: isIOC ? "white" : "#6F625B",
        }}
      >
        IOC
      </button>
    </div>
  </div>

  {/* Side Selector */}
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => setSide({ bid: {} })}
      className="flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
      style={{
        background: isBid ? "#FF7A2F" : "rgba(255, 122, 47, 0.15)",
        color: isBid ? "white" : "#FF7A2F",
        boxShadow: isBid
          ? "0 4px 12px rgba(255, 122, 47, 0.3)"
          : "none",
      }}
    >
      <TrendingUp className="w-4 h-4" />
      Buy
    </button>
    <button
      onClick={() => setSide({ ask: {} })}
      className="flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
      style={{
        background: !isBid ? "#DC2626" : "rgba(220, 38, 38, 0.1)",
        color: !isBid ? "white" : "#DC2626",
        boxShadow: !isBid
          ? "0 4px 12px rgba(220, 38, 38, 0.3)"
          : "none",
      }}
    >
      <TrendingDown className="w-4 h-4" />
      Sell
    </button>
  </div>

  {/* Price Input */}
  <div className="mb-4">
    <label className="text-sm mb-2 block" style={{ color: "#6F625B" }}>
      Price
    </label>
    <div className="rounded-lg p-3" style={{ background: "#F4F1EE" }}>
      <input
        type="number"
        value={String(price)}
        onChange={(e) => setPrice(parseFloat(e.target.value))}
        placeholder="0.00"
        className="bg-transparent text-lg font-medium outline-none w-full"
        style={{ color: "#2B1B12" }}
      />
    </div>
  </div>

  {/* Size Input */}
  <div className="mb-4">
    <label className="text-sm mb-2 block" style={{ color: "#6F625B" }}>
      Size
    </label>
    <div className="rounded-lg p-3" style={{ background: "#F4F1EE" }}>
      <input
        type="number"
        value={size}
        onChange={(e) => setSize(parseFloat(e.target.value))}
        placeholder="0.00"
        className="bg-transparent text-lg font-medium outline-none w-full"
        style={{ color: "#2B1B12" }}
      />
    </div>
  </div>

  {/* Total */}
  <div className="mb-6">
    <div
      className="flex justify-between text-sm mb-1"
      style={{ color: "#6F625B" }}
    >
      <span>Total</span>
    </div>
    <div className="rounded-lg p-3" style={{ background: "#F4F1EE" }}>
      <div className="text-lg font-semibold" style={{ color: "#2B1B12" }}>
        {total}
      </div>
    </div>
  </div>
      {/* Place Order Button */}
      {!connected ? (
        <button
          onClick={() => setVisible(true)}
          className="w-full font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(to right, #FF7A2F, #FF8F52)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(255, 122, 47, 0.3)'
          }}
        >
          <Wallet className="w-5 h-5" />
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handlePlaceOrder}
          disabled={isPending || !price || !size}
          className="w-full font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isBid 
              ? 'linear-gradient(to right, #FF7A2F, #FF8F52)' 
              : 'linear-gradient(to right, #DC2626, #EF4444)',
            color: 'white',
            boxShadow: isBid 
              ? '0 4px 12px rgba(255, 122, 47, 0.3)' 
              : '0 4px 12px rgba(220, 38, 38, 0.3)'
          }}
        >
          {isPending ? 'Placing Order...' : `Place ${isBid ? 'Buy' : 'Sell'} Order`}
        </button>
      )}

      {/* Connected Info */}
      {connected && publicKey && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(255, 122, 47, 0.15)' }}>
          <div className="flex justify-between items-center" style={{ color: '#6F625B' }}>
            <span>Connected:</span>
            <span className="font-mono font-medium" style={{ color: '#2B1B12' }}>
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        </div>
      )}
      
      {/* ✅ Open Order Modal - Show when needed */}
      {(needsOpenOrderInit || showOpenOrderModal) && (
        <OpenOrderModal 
          isOpen={showOpenOrderModal} 
          onClose={() => setShowOpenOrderModal(false)} 
        />
      )}
    </div>
  )
}

export default SwappingInterface