-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "baseLots" INTEGER NOT NULL,
    "filledLots" DECIMAL(28,9) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "placedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE INDEX "Order_ownerAddress_marketAddress_idx" ON "Order"("ownerAddress", "marketAddress");

-- CreateIndex
CREATE INDEX "Order_marketAddress_status_idx" ON "Order"("marketAddress", "status");

-- CreateIndex
CREATE INDEX "Order_orderId_idx" ON "Order"("orderId");
