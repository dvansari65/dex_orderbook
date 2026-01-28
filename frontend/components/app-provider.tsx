import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import SolanaWalletProvider from "@/providers/WalletProvider";
import { ReactNode } from "react";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SolanaWalletProvider>
      <SocketProvider>
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
      </SocketProvider>
    </SolanaWalletProvider>
  )
}