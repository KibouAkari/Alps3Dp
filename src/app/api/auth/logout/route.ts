import { NextResponse } from "next/server";

import { destroySession, AUTH_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];

  await destroySession(token);

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
  });

  return response;
}
