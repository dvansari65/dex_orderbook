import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { NetworkProvider } from "@/providers/NetworkProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import SolanaWalletProvider from "@/providers/WalletProvider";
import { ReactNode } from "react";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <NetworkProvider>
      <SolanaWalletProvider>
        <ReactQueryProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </ReactQueryProvider>
      </SolanaWalletProvider>
    </NetworkProvider>
  )
}
