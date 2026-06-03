"use client";

import { useCallback, useEffect, useState } from "react";

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

  const data = (await response.json()) as SessionApiResponse;
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
    avatar: DEFAULT_AVATAR,
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

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login fehlgeschlagen.");
    }

    const nextUser: SessionUser = {
      id: data.user.id,
      username: data.user.username ?? null,
      firstName: data.user.firstName ?? null,
      lastName: data.user.lastName ?? null,
      salutation: data.user.salutation ?? null,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatar: DEFAULT_AVATAR,
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

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Registrierung fehlgeschlagen.");
    }

    const nextUser: SessionUser = {
      id: data.user.id,
      username: data.user.username ?? null,
      firstName: data.user.firstName ?? null,
      lastName: data.user.lastName ?? null,
      salutation: data.user.salutation ?? null,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatar: DEFAULT_AVATAR,
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
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Profil konnte nicht gespeichert werden.");
    }

    const nextUser: SessionUser = {
      id: data.id,
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      salutation: data.salutation ?? null,
      name: data.name,
      email: data.email,
      role: user?.role || "CUSTOMER",
      avatar: user?.avatar || DEFAULT_AVATAR,
    };

    window.dispatchEvent(new Event(AUTH_EVENT));
    setUser(nextUser);
    return nextUser;
  }, [user?.avatar, user?.role]);

  return { user, isLoading, signIn, register, signOut, updateProfile };
}
