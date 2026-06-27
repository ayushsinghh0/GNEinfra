-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "casualLeaveQuota" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "panNo" TEXT,
ADD COLUMN     "sickLeaveQuota" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "uan" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleOnProject" TEXT,
    "allocationPct" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectAssignment_employeeId_idx" ON "ProjectAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_employeeId_projectId_key" ON "ProjectAssignment"("employeeId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

