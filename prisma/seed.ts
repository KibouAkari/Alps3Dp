import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@alps3dp.ch";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe-Admin-2026!";
  const adminName = process.env.ADMIN_NAME || "Alps3Dp Admin";

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
    update: {
      name: adminName,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
  });

  await prisma.siteSetting.upsert({
    where: { key: "shipping_cents" },
    create: { key: "shipping_cents", value: "0" },
    update: {},
  });

  console.log("Seed complete. Admin user ensured.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
