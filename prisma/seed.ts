import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!email || password.length < 8) {
    throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (8+ chars) before seeding.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Superadmin already exists: ${existing.email} (${existing.id})`);
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: "Super Admin", email, passwordHash, role: "SUPERADMIN", mustChangePassword: true },
  });
  console.log(`Seeded superadmin: ${user.email} (${user.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
