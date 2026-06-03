import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Not found",
      message: "This project uses custom auth API routes under /api/auth/*.",
    },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Not found",
      message: "This project uses custom auth API routes under /api/auth/*.",
    },
    { status: 404 },
  );
}
