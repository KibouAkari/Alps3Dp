import { NextResponse } from "next/server";
import { z } from "zod";

const testSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  salutation: z.enum(["Herr", "Frau"]).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({
      error: "Validation failed",
      details: parsed.error.errors,
      received: body,
    });
  }

  return NextResponse.json({ success: true, data: parsed.data });
}
