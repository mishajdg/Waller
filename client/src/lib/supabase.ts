/**
 * Supabase Client — konfiguracja i inicjalizacja
 * ================================================
 * Iteracja 10.1 — Karma branding.
 * Jeśli brak kluczy Supabase (.env.local nie istnieje lub placeholder),
 * aplikacja działa w trybie offline/demo z danymi lokalnymi z gymMap.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Sprawdza, czy Supabase jest prawidłowo skonfigurowany.
 * Zwraca false jeśli brak kluczy lub są placeholderami.
 */
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseAnonKey.includes("placeholder") &&
  supabaseUrl.startsWith("https://");

/**
 * Klient Supabase — tworzony tylko jeśli konfiguracja jest prawidłowa.
 * W przeciwnym razie null (tryb offline/demo).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Identyfikator gym — używany jako domyślny w zapytaniach.
 */
export const WALLER_GYM_ID = import.meta.env.VITE_WALLER_GYM_ID || "00000000-0000-0000-0000-000000000001";
