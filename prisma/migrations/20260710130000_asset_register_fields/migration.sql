-- AlterTable
ALTER TABLE "EmployeeAsset" ADD COLUMN     "assetType" TEXT,
ADD COLUMN     "assetTag" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "purchaseValue" INTEGER,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "remarks" TEXT;

-- Backfill assetType from the legacy issued-item booleans (deterministic, additive)
UPDATE "EmployeeAsset" SET "assetType" = 'Laptop'  WHERE "assetType" IS NULL AND "hasLaptop" = true;
UPDATE "EmployeeAsset" SET "assetType" = 'ID Card' WHERE "assetType" IS NULL AND "idCard" = true;
