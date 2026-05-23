import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./ops-data";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  branch: string | null;
  language: string | null;
  is_active: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ROLE_PRIORITY: Record<Role, number> = { owner: 1, staff: 2, teacher: 3, student: 4, lead: 5 };

export async function getPrimaryRole(userId: string): Promise<Role | null> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.length) return null;
  return (roles as { role: Role }[])
    .map((r) => r.role)
    .sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b])[0];
}

async function loadUserContext(userId: string): Promise<{ profile: Profile | null; role: Role | null }> {
  const [{ data: profile }, role] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    getPrimaryRole(userId),
  ]);
  return { profile: profile as Profile | null, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    try {
      if (s?.user) {
        const { profile, role } = await loadUserContext(s.user.id);
        setProfile(profile);
        setRole(role);
      } else {
        setProfile(null);
        setRole(null);
      }
    } catch (error) {
      console.error("Failed to load user context", error);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('error_description')) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // defer heavy work
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadUserContext(s.user.id).then(({ profile, role }) => {
            setProfile(profile);
            setRole(role);
          });
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthCtx["signUp"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (!user) return;
    const { profile, role } = await loadUserContext(user.id);
    setProfile(profile);
    setRole(role);
  };

  return (
    <Ctx.Provider value={{ user, session, profile, role, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

export function roleHomePath(role: Role | null): string {
  switch (role) {
    case "owner":
    case "staff":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/dashboard";
    case "lead":
      return "/dashboard";
    default:
      return "/login";
  }
}
