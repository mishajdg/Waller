/**
 * AuthContext — Zarządzanie autentykacją i rolami użytkownika
 * ============================================================
 * Obsługuje dwa tryby dostępu:
 *
 * 1. QR ANON (domyślny) — użytkownik skanuje QR bez logowania,
 *    widzi mapę read-only. Supabase anon key zapewnia dostęp SELECT.
 *
 * 2. QR ADMIN — QR kod zawiera ?token=<magic_link_token> lub
 *    ?admin=1 (do logowania). Admin loguje się email+hasło,
 *    po czym Supabase sprawdza rolę w tabeli user_roles.
 *
 * Jeśli Supabase nie jest skonfigurowany — tryb offline (anonymous).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";

export type UserRole = "admin" | "viewer" | "anonymous";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("anonymous");
  const [isLoading, setIsLoading] = useState(true);

  // Pobierz rolę użytkownika z bazy
  const fetchRole = useCallback(async (userId: string): Promise<UserRole> => {
    if (!isSupabaseConfigured || !supabase) return "anonymous";

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("gym_id", WALLER_GYM_ID)
      .single();

    if (error || !data) return "viewer";
    return data.role as UserRole;
  }, []);

  // Inicjalizacja sesji
  useEffect(() => {
    // Jeśli Supabase nie jest skonfigurowany — tryb offline
    if (!isSupabaseConfigured || !supabase) {
      setRole("anonymous");
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase!.auth.getSession();

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          const userRole = await fetchRole(currentSession.user.id);
          setRole(userRole);
        } else {
          // Sprawdź URL — czy jest token z QR admin
          const params = new URLSearchParams(window.location.search);
          const isAdminEntry = params.get("admin") === "1" || window.location.pathname.includes("admin");

          if (isAdminEntry && !currentSession) {
            setRole("anonymous");
          } else {
            setRole("anonymous");
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        setRole("anonymous");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Nasłuchuj zmian sesji (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const userRole = await fetchRole(newSession.user.id);
          setRole(userRole);
        } else {
          setRole("anonymous");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  // Logowanie email + hasło
  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase nie jest skonfigurowany." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  // Wylogowanie
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
    setRole("anonymous");
  }, []);

  const isAdmin = role === "admin";

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      isAdmin,
      isLoading,
      signIn,
      signOut,
    }),
    [session, user, role, isAdmin, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
