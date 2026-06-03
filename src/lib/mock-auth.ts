export type UserRole = "CUSTOMER" | "ADMIN";

export type SessionUser = {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  salutation?: string | null;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
};

export const AUTH_STORAGE_KEY = "alps3dp.session";
export const AUTH_EVENT = "alps3dp-session-updated";

export const DEFAULT_AVATAR =
  "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200";

export function readSession(): SessionUser | null {
  return null;
}

export function writeSession(_user: SessionUser) {
  void _user;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearSession() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function makeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
