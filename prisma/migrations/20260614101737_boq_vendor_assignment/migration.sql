-- AlterTable
ALTER TABLE "BoqItem" ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "BoqItem_vendorId_idx" ON "BoqItem"("vendorId");

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
