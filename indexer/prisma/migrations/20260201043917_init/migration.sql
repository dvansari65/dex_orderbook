-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "price" DECIMAL(28,6) NOT NULL,
    "quantity" DECIMAL(28,9) NOT NULL,
    "side" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(28,9) NOT NULL,
    "high" DECIMAL(28,9) NOT NULL,
    "low" DECIMAL(28,9) NOT NULL,
    "close" DECIMAL(28,9) NOT NULL,
    "volume" DECIMAL(28,9) NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_signature_key" ON "Trade"("signature");

-- CreateIndex
CREATE INDEX "Trade_marketAddress_timestamp_idx" ON "Trade"("marketAddress", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_marketAddress_resolution_timestamp_key" ON "Candle"("marketAddress", "resolution", "timestamp");
