import { db } from "@/lib/db";

const SHIPPING_KEY = "shipping_cents";

export async function getShippingCents() {
  const entry = await db.siteSetting.findUnique({ where: { key: SHIPPING_KEY } });
  if (!entry) {
    return 0;
  }

  const parsed = Number(entry.value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

export async function setShippingCents(value: number) {
  const normalized = Math.max(0, Math.round(value));
  await db.siteSetting.upsert({
    where: { key: SHIPPING_KEY },
    create: { key: SHIPPING_KEY, value: String(normalized) },
    update: { value: String(normalized) },
  });
  return normalized;
}
