-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "HiringStage" AS ENUM ('SOURCED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "department" TEXT,
    "band" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "jobDescription" TEXT,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "positionId" TEXT,
    "source" TEXT,
    "stage" "HiringStage" NOT NULL DEFAULT 'SOURCED',
    "cvReceived" BOOLEAN NOT NULL DEFAULT false,
    "cvLink" TEXT,
    "experienceYears" DOUBLE PRECISION,
    "noticePeriod" TEXT,
    "appliedOn" DATE,
    "notes" TEXT,
    "hiredEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_code_key" ON "JobPosition"("code");

-- CreateIndex
CREATE INDEX "JobPosition_status_idx" ON "JobPosition"("status");

-- CreateIndex
CREATE INDEX "Candidate_positionId_idx" ON "Candidate"("positionId");

-- CreateIndex
CREATE INDEX "Candidate_stage_idx" ON "Candidate"("stage");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

