-- CreateEnum
CREATE TYPE "RainIntensity" AS ENUM ('LIGHT', 'MODERATE', 'HEAVY');

-- CreateTable
CREATE TABLE "WeatherLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "intensity" "RainIntensity" NOT NULL DEFAULT 'MODERATE',
    "fromTime" TEXT,
    "toTime" TEXT,
    "totalHours" DOUBLE PRECISION,
    "daysImpacted" DOUBLE PRECISION DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialApproval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcel" TEXT,
    "block" TEXT,
    "item" TEXT NOT NULL,
    "equipment" TEXT,
    "capacityUom" TEXT,
    "uom" TEXT,
    "requiredQty" DOUBLE PRECISION,
    "receivedQty" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "qty" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherLog_projectId_idx" ON "WeatherLog"("projectId");

-- CreateIndex
CREATE INDEX "MaterialApproval_projectId_idx" ON "MaterialApproval"("projectId");

-- CreateIndex
CREATE INDEX "SafetyItem_projectId_idx" ON "SafetyItem"("projectId");

-- AddForeignKey
ALTER TABLE "WeatherLog" ADD CONSTRAINT "WeatherLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialApproval" ADD CONSTRAINT "MaterialApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyItem" ADD CONSTRAINT "SafetyItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
