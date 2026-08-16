// Authorization guard for API routes that must only be reachable by admins.
import { getSessionTokenFromRequest, getSessionUserFromToken } from "@/lib/session";

/** Resolves the current session user and returns it only if the account has the ADMIN role. */
export async function requireAdminFromRequest(request: Request) {
  const user = await getSessionUserFromToken(getSessionTokenFromRequest(request));
  return user && user.role === "ADMIN" ? user : null;
}
