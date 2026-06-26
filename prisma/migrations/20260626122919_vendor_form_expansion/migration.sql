-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "oemOrDealer" TEXT,
ADD COLUMN     "offersProduct" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offersService" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VendorProduct" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,

    CONSTRAINT "VendorProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorExperience" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "clientProject" TEXT NOT NULL,
    "scope" TEXT,
    "value" TEXT,

    CONSTRAINT "VendorExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPurchaseOrder" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT,
    "client" TEXT,
    "value" TEXT,
    "poDate" TIMESTAMP(3),

    CONSTRAINT "VendorPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorTurnover" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "amount" TEXT NOT NULL,

    CONSTRAINT "VendorTurnover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_idx" ON "VendorProduct"("vendorId");

-- CreateIndex
CREATE INDEX "VendorExperience_vendorId_idx" ON "VendorExperience"("vendorId");

-- CreateIndex
CREATE INDEX "VendorPurchaseOrder_vendorId_idx" ON "VendorPurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "VendorTurnover_vendorId_idx" ON "VendorTurnover"("vendorId");

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorExperience" ADD CONSTRAINT "VendorExperience_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPurchaseOrder" ADD CONSTRAINT "VendorPurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTurnover" ADD CONSTRAINT "VendorTurnover_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
