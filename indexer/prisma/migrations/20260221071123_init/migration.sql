/*
  Warnings:

  - You are about to alter the column `filledLots` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(28,9)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "filledLots" SET DEFAULT 0,
ALTER COLUMN "filledLots" SET DATA TYPE INTEGER;
