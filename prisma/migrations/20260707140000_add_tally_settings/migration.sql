-- CreateTable
CREATE TABLE "TallySettings" (
    "id" TEXT NOT NULL DEFAULT 'tally',
    "tallyCompanyName" TEXT,
    "salesLedger" TEXT,
    "gstLedger" TEXT,
    "bankLedger" TEXT,
    "roundOffLedger" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TallySettings_pkey" PRIMARY KEY ("id")
);

