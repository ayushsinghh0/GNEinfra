-- CreateTable
CREATE TABLE "EmployeeFamilyMember" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "dob" DATE,
    "gender" TEXT,
    "occupation" TEXT,
    "contact" TEXT,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "isNominee" BOOLEAN NOT NULL DEFAULT false,
    "nomineePct" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeFamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeFamilyMember_employeeId_idx" ON "EmployeeFamilyMember"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeFamilyMember" ADD CONSTRAINT "EmployeeFamilyMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

