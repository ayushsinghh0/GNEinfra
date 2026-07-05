-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "name" TEXT NOT NULL,
    "addressLines" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "cin" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifsc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);
