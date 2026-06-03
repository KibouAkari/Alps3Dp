import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.Alps3Dp_DATABASE_URL ||
    process.env.Alps3Dp_PRISMA_DATABASE_URL ||
    process.env.Alps3Dp_POSTGRES_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

const resolvedDatabaseUrl = resolveDatabaseUrl();
if (!process.env.DATABASE_URL && resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@alps3dp.ch";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe-Admin-2026!";
  const adminFirstName = process.env.ADMIN_FIRST_NAME || "Alps3Dp";
  const adminLastName = process.env.ADMIN_LAST_NAME || "Admin";

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      salutation: "Herr",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
    update: {
      firstName: adminFirstName,
      lastName: adminLastName,
      salutation: "Herr",
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
