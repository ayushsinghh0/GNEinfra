import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { BD_CLIENTS } from "./bd-clients";

const prisma = new PrismaClient();

async function seedSuperadmin() {
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

// The 40 clients from the BD Tracker workbook — inserted only into an EMPTY
// BdClient table, so re-running never duplicates rows or clobbers app edits.
async function seedBdClients() {
  const count = await prisma.bdClient.count();
  if (count > 0) {
    console.log(`BD clients already present (${count}) — skipping client-list seed.`);
    return;
  }
  const { count: created } = await prisma.bdClient.createMany({ data: BD_CLIENTS });
  console.log(`Seeded ${created} BD clients from the tracker's client list.`);
}

async function main() {
  await seedSuperadmin();
  await seedBdClients();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
