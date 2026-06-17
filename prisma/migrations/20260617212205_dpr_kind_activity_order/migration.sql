-- CreateEnum
CREATE TYPE "DprKind" AS ENUM ('VALUE', 'COM', 'NONE');

-- AlterTable
ALTER TABLE "DprEntry" ADD COLUMN     "kind" "DprKind" NOT NULL DEFAULT 'VALUE';

-- AlterTable
ALTER TABLE "ProjectActivity" ADD COLUMN     "activitySerial" INTEGER,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
