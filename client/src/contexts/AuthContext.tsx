/**
 * AuthContext — Zarządzanie autentykacją i rolami użytkownika
 * ============================================================
 * Obsługuje trzy tryby dostępu:
 *
 * 1. QR ANON (domyślny) — użytkownik skanuje QR bez logowania,
 *    widzi mapę read-only. Supabase anon key zapewnia dostęp SELECT.
 *
 * 2. QR ADMIN — QR kod zawiera ?token=<magic_link_token> lub
 *    ?admin=1 (do logowania). Admin loguje się email+hasło,
 *    po czym Supabase sprawdza rolę w tabeli user_roles.
 *
 * 3. KLIENT (moduł rezerwacji sekcji) — klient zakłada konto sam (signUp)
 *    i loguje się tak samo jak admin (signIn). Do user_roles NIE trafia
 *    żaden wiersz: fetchRole() traktuje każdego zalogowanego użytkownika
 *    bez wiersza w user_roles jako "viewer". Rezerwacje są powiązane z
 *    kontem przez auth.uid() (patrz supabase/003_class_sections.sql).
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
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";

export type UserRole = "admin" | "viewer" | "anonymous";

/**
 * Tłumaczy najczęstsze błędy Supabase Auth na polski.
 * Najpierw patrzy na error.code (stabilne), potem na treść komunikatu;
 * nieznane błędy przechodzą bez zmian.
 */
function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Nieprawidłowy e-mail lub hasło.";
    case "email_not_confirmed":
      return "Adres e-mail nie jest jeszcze potwierdzony — kliknij link z wiadomości, którą wysłaliśmy po rejestracji.";
    case "user_already_exists":
    case "email_exists":
      return "Konto z tym adresem e-mail już istnieje. Zaloguj się.";
    case "weak_password":
      return "Hasło jest zbyt słabe — użyj co najmniej 8 znaków.";
    case "email_address_invalid":
      return "Nieprawidłowy adres e-mail.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
    case "signup_disabled":
      return "Rejestracja jest obecnie wyłączona.";
  }
  if (/invalid login credentials/i.test(error.message)) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  return error.message;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Rejestracja klienta. needsEmailConfirmation = true, gdy w Supabase włączone
   * jest "Confirm email" — konto powstało, ale sesja pojawi się dopiero po
   * kliknięciu linku z maila.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Zalogowany użytkownik dowolnej roli (klient lub admin) */
  isLoggedIn: boolean;
  /** Imię i nazwisko z rejestracji (user_metadata.full_name) — do wstępnego wypełniania formularzy zapisu */
  displayName: string | null;
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

    // maybeSingle(): klient nie ma wiersza w user_roles (to normalne) — zwraca
    // data = null zamiast błędu 406, którego single() wywołałby przy każdym logowaniu.
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("gym_id", WALLER_GYM_ID)
      .maybeSingle();

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
    if (error) return { error: translateAuthError(error) };
    return { error: null };
  }, []);

  // Rejestracja klienta (self-service) — zwykłe konto Supabase Auth, bez wpisu w user_roles
  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!isSupabaseConfigured || !supabase) {
        return { error: "Supabase nie jest skonfigurowany.", needsEmailConfirmation: false };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          // Po kliknięciu linku z maila użytkownik wraca do aplikacji. Ten adres musi być na
          // liście Redirect URLs (Supabase → Authentication → URL Configuration),
          // inaczej Supabase użyje Site URL.
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) return { error: translateAuthError(error), needsEmailConfirmation: false };

      // Przy włączonym "Confirm email" Supabase nie zwraca błędu dla istniejącego adresu
      // (ochrona przed wyciekiem, kto ma konto) — zwraca "puste" konto z identities: [].
      if (data.user && data.user.identities?.length === 0) {
        return {
          error: "Konto z tym adresem e-mail już istnieje. Zaloguj się.",
          needsEmailConfirmation: false,
        };
      }

      // Brak sesji = trzeba jeszcze kliknąć link potwierdzający z maila.
      return { error: null, needsEmailConfirmation: !data.session };
    },
    []
  );

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
  const isLoggedIn = user !== null;

  const displayName = useMemo(() => {
    const name: unknown = user?.user_metadata?.full_name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      isAdmin,
      isLoading,
      signIn,
      signUp,
      signOut,
      isLoggedIn,
      displayName,
    }),
    [session, user, role, isAdmin, isLoading, signIn, signUp, signOut, isLoggedIn, displayName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
