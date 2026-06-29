-- AlterTable: Employee bank/statutory additions (all nullable)
ALTER TABLE "Employee" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "ifsc" TEXT;
ALTER TABLE "Employee" ADD COLUMN "esicNo" TEXT;

-- AlterTable: PayrollRecord earnings additions (non-null, default 0)
ALTER TABLE "PayrollRecord" ADD COLUMN "lta" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRecord" ADD COLUMN "specialAllowance" INTEGER NOT NULL DEFAULT 0;
