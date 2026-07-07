-- CreateEnum
CREATE TYPE "BdTechnology" AS ENUM ('SOLAR', 'BESS');

-- CreateEnum
CREATE TYPE "BdServiceCategory" AS ENUM ('PMC', 'EPC', 'INC', 'OM');

-- CreateEnum
CREATE TYPE "BdQuotationStatus" AS ENUM ('PENDING', 'QUOTE_PREPARATION', 'APPROVAL', 'QUOTE_SUBMISSION');

-- AlterTable
ALTER TABLE "BdEnquiry" ADD COLUMN     "enquirySource" TEXT,
ADD COLUMN     "nextFollowUpDate" DATE,
ADD COLUMN     "quotationStatus" "BdQuotationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "quoteRevision" TEXT,
ADD COLUMN     "quoteValidUntil" DATE,
ADD COLUMN     "serviceCategory" "BdServiceCategory",
ADD COLUMN     "submittedTo" TEXT,
ADD COLUMN     "technology" "BdTechnology";

-- AlterTable
ALTER TABLE "BdPurchaseOrder" ADD COLUMN     "serviceCategory" "BdServiceCategory",
ADD COLUMN     "technology" "BdTechnology";

-- AlterTable
ALTER TABLE "BdTarget" ADD COLUMN     "salesTarget" INTEGER,
ADD COLUMN     "serviceCategory" "BdServiceCategory",
ADD COLUMN     "technology" "BdTechnology";

