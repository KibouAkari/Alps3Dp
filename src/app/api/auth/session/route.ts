import { NextResponse } from "next/server";

import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

// Lets client components ask "who am I?" without exposing the session token
// itself; the cookie stays httpOnly and is only read server-side here.
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
