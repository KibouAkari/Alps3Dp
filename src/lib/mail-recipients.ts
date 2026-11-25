/** Operations-only recipients. Never copy private authentication emails. */
export const SHOP_MANAGER_EMAIL = "Alp.Kasemi@alps3Dp.ch";

/** Always include the designated manager even when an optional Vercel address differs. */
export function getShopOperatorRecipients(additional: Array<string | undefined> = []): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const raw of [SHOP_MANAGER_EMAIL, ...additional]) {
    const address = raw?.trim();
    if (!address || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(address)) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(address);
  }
  return recipients;
}
