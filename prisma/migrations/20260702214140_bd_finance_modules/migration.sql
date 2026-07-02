-- CreateEnum
CREATE TYPE "BdServiceType" AS ENUM ('EPC', 'OM', 'EPC_OM');

-- CreateEnum
CREATE TYPE "BdPlantType" AS ENUM ('GROUND', 'ROOF', 'HYBRID');

-- CreateEnum
CREATE TYPE "BdStage" AS ENUM ('ENQUIRY', 'QUOTE_SUBMITTED', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "BdFinalStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "BdClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "serviceType" "BdServiceType",
    "plantType" "BdPlantType",
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdEnquiry" (
    "id" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "enquiryDate" DATE,
    "enquiryType" TEXT,
    "clientId" TEXT NOT NULL,
    "personName" TEXT,
    "contactNo" TEXT,
    "location" TEXT,
    "projectType" TEXT,
    "activities" TEXT,
    "unit" TEXT,
    "qty" INTEGER,
    "quoteNo" TEXT,
    "submissionDate" DATE,
    "projectStatus" TEXT,
    "probabilityPct" INTEGER,
    "forecastedRevenue" INTEGER,
    "stage" "BdStage" NOT NULL DEFAULT 'ENQUIRY',
    "expectedClosure" DATE,
    "finalStatus" "BdFinalStatus" NOT NULL DEFAULT 'OPEN',
    "customerContact" TEXT,
    "value" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdPurchaseOrder" (
    "id" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "receivedDate" DATE,
    "projectType" TEXT,
    "clientId" TEXT NOT NULL,
    "activities" TEXT,
    "quoteNo" TEXT,
    "enquiryId" TEXT,
    "projectQty" TEXT,
    "projectPeriod" TEXT,
    "poNumber" TEXT,
    "poValue" INTEGER,
    "poDate" DATE,
    "poStart" DATE,
    "poEnd" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdTarget" (
    "id" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "quarter" TEXT,
    "states" TEXT,
    "keyAccountPerson" TEXT,
    "project" TEXT,
    "serviceType" "BdServiceType",
    "plantType" "BdPlantType",
    "projectSize" TEXT,
    "locations" INTEGER,
    "estimatedValue" INTEGER,
    "probabilityPct" INTEGER,
    "forecastedRevenue" INTEGER,
    "orderReceived" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "orderNo" TEXT,
    "orderDate" DATE,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "billTo" TEXT NOT NULL,
    "shipTo" TEXT,
    "gstLabel" TEXT NOT NULL DEFAULT 'IGST',
    "gstRate" INTEGER NOT NULL DEFAULT 18,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "gstAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDate" DATE,
    "paymentRef" TEXT,
    "paymentMarkedBy" TEXT,
    "createdByName" TEXT,
    "submittedByName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedByName" TEXT,
    "decidedByRole" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sacCode" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "uom" TEXT,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nopa" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "nopaNo" TEXT NOT NULL,
    "nopaDate" DATE NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Green Next Energy Infra Pvt Ltd',
    "plantName" TEXT,
    "partyName" TEXT,
    "itemDescription" TEXT,
    "poRef" TEXT,
    "gstRate" INTEGER NOT NULL DEFAULT 18,
    "basicAmount" INTEGER NOT NULL DEFAULT 0,
    "gstAmount" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "advancePaid" INTEGER NOT NULL DEFAULT 0,
    "advanceRequest" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifsc" TEXT,
    "branchName" TEXT,
    "initiatedBy" TEXT,
    "checkedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nopa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NopaLine" (
    "id" TEXT NOT NULL,
    "nopaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qtyWords" TEXT,
    "uom" TEXT,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NopaLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BdClient_name_idx" ON "BdClient"("name");

-- CreateIndex
CREATE INDEX "BdEnquiry_clientId_idx" ON "BdEnquiry"("clientId");

-- CreateIndex
CREATE INDEX "BdEnquiry_stage_idx" ON "BdEnquiry"("stage");

-- CreateIndex
CREATE INDEX "BdEnquiry_finalStatus_idx" ON "BdEnquiry"("finalStatus");

-- CreateIndex
CREATE INDEX "BdEnquiry_fiscalYear_idx" ON "BdEnquiry"("fiscalYear");

-- CreateIndex
CREATE INDEX "BdPurchaseOrder_clientId_idx" ON "BdPurchaseOrder"("clientId");

-- CreateIndex
CREATE INDEX "BdPurchaseOrder_fiscalYear_idx" ON "BdPurchaseOrder"("fiscalYear");

-- CreateIndex
CREATE INDEX "BdTarget_fiscalYear_idx" ON "BdTarget"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Nopa_invoiceId_key" ON "Nopa"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Nopa_nopaNo_key" ON "Nopa"("nopaNo");

-- CreateIndex
CREATE INDEX "NopaLine_nopaId_idx" ON "NopaLine"("nopaId");

-- AddForeignKey
ALTER TABLE "BdEnquiry" ADD CONSTRAINT "BdEnquiry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "BdClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdPurchaseOrder" ADD CONSTRAINT "BdPurchaseOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "BdClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdPurchaseOrder" ADD CONSTRAINT "BdPurchaseOrder_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "BdEnquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nopa" ADD CONSTRAINT "Nopa_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NopaLine" ADD CONSTRAINT "NopaLine_nopaId_fkey" FOREIGN KEY ("nopaId") REFERENCES "Nopa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
