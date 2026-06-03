import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

const createAddressSchema = z.object({
  salutation: z.enum(["Herr", "Frau"]).optional(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  street: z.string().min(1).max(120),
  zipCode: z.string().min(1).max(20),
  city: z.string().min(1).max(60),
  country: z.string().min(2).max(2).default("CH"),
  isDefault: z.boolean().optional(),
});

// GET - Retrieve all addresses for user
export async function GET(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const addresses = await db.userAddress.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

// POST - Create new address
export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createAddressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  // If setting as default, unset all other defaults
  if (parsed.data.isDefault) {
    await db.userAddress.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await db.userAddress.create({
    data: {
      userId: user.id,
      ...parsed.data,
    },
  });

  return NextResponse.json({ address }, { status: 201 });
}
