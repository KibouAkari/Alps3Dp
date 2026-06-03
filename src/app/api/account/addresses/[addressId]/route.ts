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

const updateAddressSchema = z.object({
  salutation: z.enum(["Herr", "Frau"]).optional(),
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  street: z.string().min(1).max(120).optional(),
  zipCode: z.string().min(1).max(20).optional(),
  city: z.string().min(1).max(60).optional(),
  country: z.string().min(2).max(2).optional(),
  isDefault: z.boolean().optional(),
});

// PATCH - Update address
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ addressId: string }> }
) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const { addressId } = await params;

  const address = await db.userAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Adresse nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAddressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  // If setting as default, unset all other defaults
  if (parsed.data.isDefault) {
    await db.userAddress.updateMany({
      where: { userId: user.id, id: { not: addressId } },
      data: { isDefault: false },
    });
  }

  const updated = await db.userAddress.update({
    where: { id: addressId },
    data: parsed.data,
  });

  return NextResponse.json({ address: updated });
}

// DELETE - Delete address
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ addressId: string }> }
) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const { addressId } = await params;

  const address = await db.userAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Adresse nicht gefunden." }, { status: 404 });
  }

  await db.userAddress.delete({
    where: { id: addressId },
  });

  return NextResponse.json({ success: true });
}
