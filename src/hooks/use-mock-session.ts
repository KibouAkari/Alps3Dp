"use client";

// Client-side hook wrapping the cookie-based session API (/api/auth/*).
// Despite the name, this talks to real server sessions — nothing here is mocked.
import { useCallback, useEffect, useState } from "react";

import { parseJsonSafely } from "@/lib/fetch-json";
import {
  AUTH_EVENT,
  DEFAULT_AVATAR,
  SessionUser,
  UserRole,
} from "@/lib/mock-auth";

type SignInInput = {
  email: string;
  password?: string;
};

type RegisterInput = {
  firstName?: string;
  lastName?: string;
  salutation?: "Herr" | "Frau";
  username?: string;
  email: string;
  password: string;
};

type SessionApiResponse = {
  user: {
    id: string;
    avatarUrl?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    salutation?: string | null;
    name: string;
    email: string;
    role: UserRole;
  } | null;
};

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (!response.ok) {
    return null;
  }

  const data = (await parseJsonSafely(response)) as Partial<SessionApiResponse>;
  if (!data.user) {
    return null;
  }

  return {
    id: data.user.id,
    username: data.user.username ?? null,
    firstName: data.user.firstName ?? null,
    lastName: data.user.lastName ?? null,
    salutation: data.user.salutation ?? null,
    name: data.user.name,
    email: data.user.email,
    role: data.user.role,
    avatar: data.user.avatarUrl || DEFAULT_AVATAR,
  };
}

export function useMockSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchSession().then((sessionUser) => {
      if (!mounted) {
        return;
      }
      setUser(sessionUser);
      setIsLoading(false);
    });

    const sync = () => {
      fetchSession().then((sessionUser) => setUser(sessionUser));
    };
    window.addEventListener(AUTH_EVENT, sync);

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_EVENT, sync);
    };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    });

    let data: Record<string, unknown> = {};
    data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        (data.error as string | undefined) || "Benutzername oder Passwort inkorrekt.",
      );
    }

    const nextUser: SessionUser = {
      id: (data.user as Record<string, unknown>).id as string,
      avatar: ((data.user as Record<string, unknown>).avatarUrl as string | undefined) || DEFAULT_AVATAR,
      username: ((data.user as Record<string, unknown>).username as string | null | undefined) ?? null,
      firstName: ((data.user as Record<string, unknown>).firstName as string | null | undefined) ?? null,
      lastName: ((data.user as Record<string, unknown>).lastName as string | null | undefined) ?? null,
      salutation: ((data.user as Record<string, unknown>).salutation as string | null | undefined) ?? null,
      name: (data.user as Record<string, unknown>).name as string,
      email: (data.user as Record<string, unknown>).email as string,
      role: (data.user as Record<string, unknown>).role as UserRole,
    };

    window.dispatchEvent(new Event(AUTH_EVENT));
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        salutation: input.salutation,
        username: input.username,
        email: input.email,
        password: input.password,
      }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error((data.error as string | undefined) || "Registrierung fehlgeschlagen.");
    }

    const registeredUser = data.user as Record<string, unknown>;
    const nextUser: SessionUser = {
      id: registeredUser.id as string,
      avatar: (registeredUser.avatarUrl as string | undefined) || DEFAULT_AVATAR,
      username: (registeredUser.username as string | null | undefined) ?? null,
      firstName: (registeredUser.firstName as string | null | undefined) ?? null,
      lastName: (registeredUser.lastName as string | null | undefined) ?? null,
      salutation: (registeredUser.salutation as string | null | undefined) ?? null,
      name: registeredUser.name as string,
      email: registeredUser.email as string,
      role: registeredUser.role as UserRole,
    };

    window.dispatchEvent(new Event(AUTH_EVENT));
    setUser(nextUser);
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.dispatchEvent(new Event(AUTH_EVENT));
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (partial: Partial<SessionUser>) => {
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        firstName: partial.firstName,
        lastName: partial.lastName,
        salutation: partial.salutation,
        username: partial.username,
        avatarUrl: partial.avatar,
      }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error((data.error as string | undefined) || "Profil konnte nicht gespeichert werden.");
    }

    const nextUser: SessionUser = {
      id: data.id as string,
      username: (data.username as string | null | undefined) ?? null,
      firstName: (data.firstName as string | null | undefined) ?? null,
      lastName: (data.lastName as string | null | undefined) ?? null,
      salutation: (data.salutation as string | null | undefined) ?? null,
      name: data.name as string,
      email: data.email as string,
      role: user?.role || "CUSTOMER",
      avatar: (data.avatarUrl as string | undefined) || user?.avatar || DEFAULT_AVATAR,
    };

    window.dispatchEvent(new Event(AUTH_EVENT));
    setUser(nextUser);
    return nextUser;
  }, [user?.avatar, user?.role]);

  return { user, isLoading, signIn, register, signOut, updateProfile };
}
