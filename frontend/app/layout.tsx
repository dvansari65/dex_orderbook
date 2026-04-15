import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Velox Dex Orderbook",
  description: "Realtime devnet orderbook and candle chart",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProvider>
          {children}
        </AppProvider>
        <Toaster position="top-right"/>
      </body>
    </html>
  );
}
