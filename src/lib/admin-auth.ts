import { AUTH_COOKIE_NAME, getSessionUserFromToken } from "@/lib/session";

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function requireAdminFromRequest(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  return user && user.role === "ADMIN" ? user : null;
}
