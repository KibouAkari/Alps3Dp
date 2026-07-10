import { getSessionTokenFromRequest, getSessionUserFromToken } from "@/lib/session";

export async function requireAdminFromRequest(request: Request) {
  const user = await getSessionUserFromToken(getSessionTokenFromRequest(request));
  return user && user.role === "ADMIN" ? user : null;
}
