/*
  Warnings:

  - You are about to drop the column `sizeBytes` on the `VendorDocument` table. All the data in the column will be lost.
  - You are about to drop the column `storedPath` on the `VendorDocument` table. All the data in the column will be lost.
  - Added the required column `storageKey` to the `VendorDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VendorDocument" DROP COLUMN "sizeBytes",
DROP COLUMN "storedPath",
ADD COLUMN     "compressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstDownloadedAt" TIMESTAMP(3),
ADD COLUMN     "originalSize" INTEGER,
ADD COLUMN     "purgeAfter" TIMESTAMP(3),
ADD COLUMN     "purgedAt" TIMESTAMP(3),
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "storedSize" INTEGER;

-- CreateIndex
CREATE INDEX "VendorDocument_purgeAfter_idx" ON "VendorDocument"("purgeAfter");
