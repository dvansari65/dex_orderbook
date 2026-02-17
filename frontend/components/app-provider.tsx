import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import SolanaWalletProvider from "@/providers/WalletProvider";
import { ReactNode } from "react";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SolanaWalletProvider>
      <ReactQueryProvider>
        <SocketProvider>
          {children}
        </SocketProvider>
      </ReactQueryProvider>
    </SolanaWalletProvider>
  )
}