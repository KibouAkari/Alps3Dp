import { NextResponse } from "next/server";

import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function GET(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
