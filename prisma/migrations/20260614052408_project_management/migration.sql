-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('PLANNING', 'ENGINEERING', 'PROCUREMENT', 'CONSTRUCTION', 'TESTING', 'COMMISSIONING', 'LIVE', 'HANDOVER', 'CLOSED');

-- CreateEnum
CREATE TYPE "BoqCategory" AS ENUM ('SUPPLY', 'SERVICE', 'LINE_WORK');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "gneId" TEXT NOT NULL,
    "clientName" TEXT,
    "tenderId" TEXT,
    "state" TEXT,
    "cluster" TEXT,
    "plantName" TEXT,
    "capacityAcMw" DOUBLE PRECISION,
    "capacityDcMw" DOUBLE PRECISION,
    "epcScope" TEXT,
    "poNumber" TEXT,
    "poValueCr" DOUBLE PRECISION,
    "subPartner" TEXT,
    "vendorId" TEXT,
    "plantAddress" TEXT,
    "clientAddress" TEXT,
    "stage" "ProjectStage" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "liveDate" TIMESTAMP(3),
    "completeDate" TIMESTAMP(3),
    "handoverDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProjectBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" "BoqCategory" NOT NULL DEFAULT 'SUPPLY',
    "section" TEXT,
    "serialNo" TEXT,
    "description" TEXT NOT NULL,
    "rating" TEXT,
    "specification" TEXT,
    "uom" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitRate" DOUBLE PRECISION,
    "responsibility" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT,
    "activity" TEXT NOT NULL,
    "subActivity" TEXT,
    "uom" TEXT,
    "totalQty" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DprEntry" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "qtyDone" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DprEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partner" TEXT,
    "type" TEXT,
    "description" TEXT NOT NULL,
    "uom" TEXT,
    "approvedQty" DOUBLE PRECISION,
    "drawingApproved" BOOLEAN NOT NULL DEFAULT false,
    "poReleased" BOOLEAN NOT NULL DEFAULT false,
    "receivedQty" DOUBLE PRECISION,
    "receivedDate" TIMESTAMP(3),
    "qualitySignoff" BOOLEAN NOT NULL DEFAULT false,
    "mrcStatus" TEXT,
    "paymentStatus" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_gneId_key" ON "Project"("gneId");

-- CreateIndex
CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- CreateIndex
CREATE INDEX "Project_clientName_idx" ON "Project"("clientName");

-- CreateIndex
CREATE INDEX "ProjectBlock_projectId_idx" ON "ProjectBlock"("projectId");

-- CreateIndex
CREATE INDEX "BoqItem_projectId_idx" ON "BoqItem"("projectId");

-- CreateIndex
CREATE INDEX "BoqItem_category_idx" ON "BoqItem"("category");

-- CreateIndex
CREATE INDEX "ProjectActivity_projectId_idx" ON "ProjectActivity"("projectId");

-- CreateIndex
CREATE INDEX "DprEntry_activityId_idx" ON "DprEntry"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "DprEntry_activityId_date_key" ON "DprEntry"("activityId", "date");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "ProcurementItem_projectId_idx" ON "ProcurementItem"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBlock" ADD CONSTRAINT "ProjectBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DprEntry" ADD CONSTRAINT "DprEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProjectActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
