-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('INVITED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'SUBMITTED',
    "vendorCode" TEXT,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "mobileNumber" TEXT,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "state" TEXT,
    "website" TEXT,
    "dateOfIncorporation" TIMESTAMP(3),
    "yearsOfService" TEXT,
    "annualTurnover" TEXT,
    "gstNo" TEXT NOT NULL,
    "panNo" TEXT NOT NULL,
    "exciseNo" TEXT,
    "tinNo" TEXT,
    "vatLstNo" TEXT,
    "cstNo" TEXT,
    "serviceTaxNo" TEXT,
    "msmeNo" TEXT,
    "bankName" TEXT,
    "bankBranchAddress" TEXT,
    "bankAccountNo" TEXT,
    "bankBranchCode" TEXT,
    "ifscCode" TEXT,
    "swiftCode" TEXT,
    "ibanCode" TEXT,
    "genBusPostingGroup" TEXT,
    "exciseBusPostingGroup" TEXT,
    "natureOfServices" TEXT,
    "vendorPostingGroup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProject" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serialNo" INTEGER,
    "clientName" TEXT,
    "capacity" TEXT,
    "projectType" TEXT,
    "contractType" TEXT,
    "location" TEXT,
    "yearOfCompletion" TEXT,
    "scopeOfWork" TEXT,
    "percentCompleted" TEXT,
    "remarks" TEXT,

    CONSTRAINT "VendorProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDocument" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "originalSize" INTEGER,
    "storedSize" INTEGER,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "firstDownloadedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "VendorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "companyHint" TEXT,
    "vendorId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "VendorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentId" TEXT,
    "docType" TEXT NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE INDEX "Vendor_companyName_idx" ON "Vendor"("companyName");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_gstNo_idx" ON "Vendor"("gstNo");

-- CreateIndex
CREATE INDEX "VendorProject_vendorId_idx" ON "VendorProject"("vendorId");

-- CreateIndex
CREATE INDEX "VendorDocument_vendorId_idx" ON "VendorDocument"("vendorId");

-- CreateIndex
CREATE INDEX "VendorDocument_purgeAfter_idx" ON "VendorDocument"("purgeAfter");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvite_token_key" ON "VendorInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvite_vendorId_key" ON "VendorInvite"("vendorId");

-- CreateIndex
CREATE INDEX "VendorInvite_email_idx" ON "VendorInvite"("email");

-- CreateIndex
CREATE INDEX "VendorInvite_status_idx" ON "VendorInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_token_key" ON "DocumentRequest"("token");

-- CreateIndex
CREATE INDEX "DocumentRequest_vendorId_idx" ON "DocumentRequest"("vendorId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- AddForeignKey
ALTER TABLE "VendorProject" ADD CONSTRAINT "VendorProject_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDocument" ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvite" ADD CONSTRAINT "VendorInvite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

