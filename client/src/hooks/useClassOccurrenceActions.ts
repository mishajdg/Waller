/**
 * useClassOccurrenceActions — tworzenie i anulowanie terminów dla admina
 * ============================================================================
 * generateWeeklyOccurrences zamyka lukę "brak generowania cyklicznych
 * terminów" — admin podaje PIERWSZY termin + liczbę tygodni, reszta to ten
 * sam dzień tygodnia/godzina co 7 dni (bulk insert jednym zapytaniem).
 */
import { useCallback } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

/**
 * Dodaje tygodnie zachowując lokalną godzinę ściany (nie: stałą liczbę ms).
 * Prosta arytmetyka "+7*86400000 ms" psuje godzinę przy przejściu czasu
 * letni/zimowy — zweryfikowane empirycznie: "wtorek 18:00" przed 25.10.2026
 * (ostatnia niedziela października — zmiana czasu w Polsce) stawało się po
 * tej dacie "17:00" przy liczeniu w ms, mimo że setDate() poprawnie zostaje
 * przy 18:00. 8-tygodniowy cykl łatwo przechodzi przez taką granicę.
 */
const addWeeks = (date: Date, weeks: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
};

export interface SingleOccurrenceDraft {
  sectionId: string;
  startsAt: string; // ISO datetime
  durationMinutes: number;
  capacity: number;
}

export interface WeeklyOccurrenceDraft {
  sectionId: string;
  firstStartsAt: string; // ISO datetime pierwszego terminu
  durationMinutes: number;
  capacity: number;
  weeksCount: number; // 1-52
}

export function useClassOccurrenceActions(gymId: string = WALLER_GYM_ID) {
  const addOccurrence = useCallback(
    async (draft: SingleOccurrenceDraft) => {
      const client = requireSupabase();
      const start = new Date(draft.startsAt);
      if (Number.isNaN(start.getTime())) throw new Error("Nieprawidłowa data startu.");
      const end = new Date(start.getTime() + draft.durationMinutes * 60_000);

      const { data, error } = await client
        .from("class_occurrences")
        .insert({
          gym_id: gymId,
          section_id: draft.sectionId,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          capacity: draft.capacity,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    [gymId]
  );

  const generateWeeklyOccurrences = useCallback(
    async (draft: WeeklyOccurrenceDraft) => {
      const client = requireSupabase();
      const firstStart = new Date(draft.firstStartsAt);
      if (Number.isNaN(firstStart.getTime())) throw new Error("Nieprawidłowa data startu.");
      if (draft.weeksCount < 1 || draft.weeksCount > 52) {
        throw new Error("Liczba tygodni musi być między 1 a 52.");
      }

      const rows = Array.from({ length: draft.weeksCount }, (_, i) => {
        const occStart = addWeeks(firstStart, i);
        const occEnd = new Date(occStart.getTime() + draft.durationMinutes * 60_000);
        return {
          gym_id: gymId,
          section_id: draft.sectionId,
          starts_at: occStart.toISOString(),
          ends_at: occEnd.toISOString(),
          capacity: draft.capacity,
        };
      });

      const { data, error } = await client.from("class_occurrences").insert(rows).select();
      if (error) throw new Error(error.message);
      return data;
    },
    [gymId]
  );

  /** Anuluje termin ORAZ wszystkie jego aktywne rezerwacje (confirmed/waitlisted).
   *  Nie wysyła powiadomienia klientowi — patrz AGENTS.md / raport, sekcja
   *  "Powiadomienia" wciąż wymaga wyboru dostawcy e-mail/SMS. */
  const cancelOccurrence = useCallback(async (occurrenceId: string) => {
    const client = requireSupabase();

    const { error: occurrenceError } = await client
      .from("class_occurrences")
      .update({ status: "cancelled" })
      .eq("id", occurrenceId);
    if (occurrenceError) throw new Error(occurrenceError.message);

    const { error: bookingsError } = await client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("occurrence_id", occurrenceId)
      .neq("status", "cancelled");
    if (bookingsError) throw new Error(bookingsError.message);
  }, []);

  return { addOccurrence, generateWeeklyOccurrences, cancelOccurrence };
}
