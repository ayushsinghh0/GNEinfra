-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('INVITED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'REVOKED');

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
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
CREATE UNIQUE INDEX "VendorInvite_token_key" ON "VendorInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvite_vendorId_key" ON "VendorInvite"("vendorId");

-- CreateIndex
CREATE INDEX "VendorInvite_email_idx" ON "VendorInvite"("email");

-- CreateIndex
CREATE INDEX "VendorInvite_status_idx" ON "VendorInvite"("status");

-- AddForeignKey
ALTER TABLE "VendorProject" ADD CONSTRAINT "VendorProject_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDocument" ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvite" ADD CONSTRAINT "VendorInvite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
