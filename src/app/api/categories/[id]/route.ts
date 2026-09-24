import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { makeSlug } from "@/lib/security";

// Admin-only rename/delete for a single category. Renaming updates every
// product referencing it (it's a real relation, not a denormalized string).
// Deleting clears categoryId on its products instead of touching them
// (see schema.prisma Product.category onDelete: SetNull) so products are
// never deleted as a side effect of removing a category.
const renameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Kategoriename." }, { status: 400 });
  }

  const { id } = await params;
  const name = parsed.data.name;

  try {
    const updated = await db.category.update({
      where: { id },
      data: { name, slug: makeSlug(name) },
    });
    return NextResponse.json({ category: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Eine Kategorie mit diesem Namen existiert bereits." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Kategorie wurde nicht gefunden." }, { status: 404 });
    }
    console.error("[categories:update]", error);
    return NextResponse.json({ error: "Kategorie konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Kategorie wurde nicht gefunden." }, { status: 404 });
    }
    console.error("[categories:delete]", error);
    return NextResponse.json({ error: "Kategorie konnte nicht gelöscht werden." }, { status: 500 });
  }
}
