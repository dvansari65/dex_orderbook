"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSocketStatus } from "@/providers/SocketProvider";
import { WifiOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export const ConnectionStatus = () => {
  const isConnected = useSocketStatus();
  const [show, setShow] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setShow(true);
    } else {
      // delay hiding to prevent flicker
      const timeout = setTimeout(() => {
        setShow(false);
      }, 1500); // tweak (1–2s is good)
  
      return () => clearTimeout(timeout);
    }
  }, [isConnected]);

  const handleRetry = () => {
    setIsRetrying(true);
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed top-20 left-1/2 z-[100] -translate-x-1/2"
        >
          <div 
            className="relative overflow-hidden rounded-xl border px-6 py-4 shadow-2xl backdrop-blur-xl"
            style={{ 
              borderColor: 'var(--phoenix-ask-soft)',
              backgroundColor: 'var(--phoenix-bg-glass-strong)',
              boxShadow: 'var(--phoenix-shadow-lg)'
            }}
          >
            {/* Animated gradient border effect */}
            <div 
              className="absolute inset-0 rounded-xl opacity-50"
              style={{
                background: 'linear-gradient(90deg, var(--phoenix-ask-soft), rgba(255, 122, 47, 0.1), var(--phoenix-ask-soft))'
              }}
            />

            {/* Pulsing background glow */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-1 rounded-xl blur-xl"
              style={{ backgroundColor: 'var(--phoenix-ask-soft)' }}
            />

            <div className="relative flex items-center gap-4">
              {/* Icon with pulse animation */}
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="rounded-full p-2"
                  style={{ backgroundColor: 'var(--phoenix-ask-soft)' }}
                >
                  <WifiOff 
                    className="h-5 w-5" 
                    style={{ color: 'var(--phoenix-ask)' }}
                  />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'var(--phoenix-ask-soft)' }}
                />
              </div>

              {/* Text content */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-sm font-semibold"
                    style={{ color: 'var(--phoenix-ask)' }}
                  >
                    Indexer Offline
                  </span>
                  <span 
                    className="flex h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--phoenix-ask)' }}
                  >
                    <motion.span
                      animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--phoenix-ask)' }}
                    />
                  </span>
                </div>
                <span 
                  className="text-xs"
                  style={{ color: 'var(--phoenix-text-secondary)' }}
                >
                  Real-time data unavailable
                </span>
              </div>

              {/* Retry button */}
              <motion.button
                onClick={handleRetry}
                disabled={isRetrying}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="ml-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                style={{ 
                  borderColor: 'var(--phoenix-ask-soft)',
                  backgroundColor: 'var(--phoenix-ask-soft)',
                  color: 'var(--phoenix-ask)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(224, 49, 49, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--phoenix-ask-soft)';
                }}
              >
                <RefreshCw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry"}
              </motion.button>
            </div>

            {/* Progress bar at bottom */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-0 left-0 h-[2px] w-full origin-left"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--phoenix-ask), transparent)'
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};