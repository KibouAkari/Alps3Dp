// Client-side session constants and types shared with use-mock-session.ts.
// Despite the filename, session state itself is real: it's fetched from the
// httpOnly cookie session on the server (see src/lib/session.ts) and only
// mirrored here for the UI. AUTH_EVENT lets any component broadcast "the
// session changed" so others (e.g. the header cart badge) can refetch.
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

