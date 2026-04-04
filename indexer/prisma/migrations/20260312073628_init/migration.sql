/*
  Warnings:

  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'Settled';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "settledAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'Open';

-- CreateIndex
CREATE INDEX "Order_marketAddress_status_idx" ON "Order"("marketAddress", "status");
