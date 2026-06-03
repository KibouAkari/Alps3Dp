import { NextResponse } from "next/server";
import { z } from "zod";

import { getShippingCents, setShippingCents } from "@/lib/site-settings";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const schema = z.object({
  shippingCents: z.number().int().nonnegative(),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function GET() {
  return NextResponse.json({ shippingCents: await getShippingCents() });
}

export async function PATCH(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltiger Versandbetrag." }, { status: 400 });
  }

  const shippingCents = await setShippingCents(parsed.data.shippingCents);
  return NextResponse.json({ shippingCents });
}
