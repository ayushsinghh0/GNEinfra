-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'HOLIDAY', 'WEEK_OFF');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "empCategory" TEXT,
    "payrollType" TEXT,
    "mailId" TEXT,
    "location" TEXT,
    "emergencyNumber" TEXT,
    "bloodGroup" TEXT,
    "iCardNo" TEXT,
    "dob" TIMESTAMP(3),
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "offerLetterDate" TIMESTAMP(3),
    "leavingDate" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalCtc" INTEGER,
    "salary" INTEGER,
    "lta" INTEGER,
    "specialAllowance" INTEGER,
    "conveyance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAsset" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hasLaptop" BOOLEAN NOT NULL DEFAULT false,
    "lpSerialNo" TEXT,
    "makeModel" TEXT,
    "lpCategory" TEXT,
    "oemName" TEXT,
    "laptopBag" BOOLEAN NOT NULL DEFAULT false,
    "mouse" BOOLEAN NOT NULL DEFAULT false,
    "charger" BOOLEAN NOT NULL DEFAULT false,
    "idCard" BOOLEAN NOT NULL DEFAULT false,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "code" TEXT,
    "role" TEXT,
    "designation" TEXT,
    "doj" TIMESTAMP(3),
    "ctc" INTEGER,
    "basic" INTEGER NOT NULL DEFAULT 0,
    "hra" INTEGER NOT NULL DEFAULT 0,
    "cca" INTEGER NOT NULL DEFAULT 0,
    "personalPay" INTEGER NOT NULL DEFAULT 0,
    "conveyance" INTEGER NOT NULL DEFAULT 0,
    "pla" INTEGER NOT NULL DEFAULT 0,
    "medicalReimb" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" INTEGER NOT NULL DEFAULT 0,
    "tds" INTEGER NOT NULL DEFAULT 0,
    "loanAdv" INTEGER NOT NULL DEFAULT 0,
    "epf" INTEGER NOT NULL DEFAULT 0,
    "esi" INTEGER NOT NULL DEFAULT 0,
    "totalDeductions" INTEGER NOT NULL DEFAULT 0,
    "payableAmount" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_empId_key" ON "Employee"("empId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_location_idx" ON "Employee"("location");

-- CreateIndex
CREATE INDEX "Employee_designation_idx" ON "Employee"("designation");

-- CreateIndex
CREATE INDEX "EmployeeAsset_employeeId_idx" ON "EmployeeAsset"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");

-- CreateIndex
CREATE INDEX "PayrollRecord_periodYear_periodMonth_idx" ON "PayrollRecord"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_periodYear_periodMonth_key" ON "PayrollRecord"("employeeId", "periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "EmployeeAsset" ADD CONSTRAINT "EmployeeAsset_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

