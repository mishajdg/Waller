/**
 * useClassSchedule — grafik sekcji wspinaczkowych (moduł rezerwacji)
 * =====================================================================
 * Pobiera aktywne class_sections + nadchodzące class_occurrences (status
 * 'scheduled', starts_at >= teraz), a dla zalogowanego klienta — jego własne
 * rezerwacje na te terminy (RLS i tak zwróci tylko jego wiersze).
 *
 * confirmed_count/waitlisted_count przychodzą gotowe z class_occurrences
 * (utrzymywane triggerem w bazie) — nie liczymy zajętości sami z bookings,
 * bo RLS ogranicza SELECT na bookings do własnego wiersza klienta lub admina.
 *
 * Realtime: class_sections/class_occurrences są publicznie czytelne, więc
 * każdy widz dostaje żywe aktualizacje zajętości. bookings nie ma filtra —
 * RLS i tak przepuści klientowi tylko jego wiersze (to powiadomienie
 * "twoja rezerwacja się zmieniła", nie wyciek cudzych danych).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { Booking, ClassOccurrence, ClassSection, SectionSchedule } from "../types";

interface ScheduleState {
  schedule: SectionSchedule[];
  isLoading: boolean;
  error: string | null;
}

// Eksportowane — AdminSchedulePage reużywa tego samego mapowania do własnych
// zapytań (pełna lista sekcji/terminów, nie tylko aktywne/nadchodzące).
export function mapSectionRow(row: any): ClassSection {
  return {
    id: row.id,
    gymId: row.gym_id,
    name: row.name,
    description: row.description || "",
    kind: row.kind,
    instructorId: row.instructor_id ?? null,
    defaultCapacity: row.default_capacity,
    priceInfo: row.price_info || "",
    isActive: row.is_active,
  };
}

export function mapOccurrenceRow(row: any): ClassOccurrence {
  return {
    id: row.id,
    sectionId: row.section_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    confirmedCount: row.confirmed_count ?? 0,
    waitlistedCount: row.waitlisted_count ?? 0,
    status: row.status,
  };
}

function mapBookingRow(row: any): Booking {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    clientUserId: row.client_user_id,
    clientName: row.client_name,
    clientPhone: row.client_phone || "",
    status: row.status,
    createdAt: row.created_at,
  };
}

export function useClassSchedule(gymId: string = WALLER_GYM_ID) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<ScheduleState>({
    schedule: [],
    isLoading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    if (!isSupabaseConfigured || !supabase) {
      setState({ schedule: [], isLoading: false, error: "Supabase nie jest skonfigurowany." });
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const [sectionsRes, occurrencesRes, instructorsRes] = await Promise.all([
        supabase
          .from("class_sections")
          .select("*")
          .eq("gym_id", gymId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("class_occurrences")
          .select("*")
          .eq("gym_id", gymId)
          .eq("status", "scheduled")
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true }),
        // Publicznie czytelne (instructors_read_all) — potrzebne tylko do pokazania
        // imienia instruktora przy sekcji, bez tego ClassSection ma jedynie instructorId.
        supabase.from("instructors").select("id, name"),
      ]);

      if (sectionsRes.error) throw sectionsRes.error;
      if (occurrencesRes.error) throw occurrencesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      const sections = (sectionsRes.data || []).map(mapSectionRow);
      const occurrences = (occurrencesRes.data || []).map(mapOccurrenceRow);
      const instructorNameById = new Map<string, string>(
        (instructorsRes.data || []).map((row: any) => [row.id, row.name])
      );

      let myBookings: Booking[] = [];
      if (userId && occurrences.length > 0) {
        const occurrenceIds = occurrences.map((occurrence) => occurrence.id);
        const bookingsRes = await supabase
          .from("bookings")
          .select("*")
          .in("occurrence_id", occurrenceIds)
          .neq("status", "cancelled");
        if (bookingsRes.error) throw bookingsRes.error;
        myBookings = (bookingsRes.data || []).map(mapBookingRow);
      }

      const bookingByOccurrence = new Map(myBookings.map((booking) => [booking.occurrenceId, booking]));

      const schedule: SectionSchedule[] = sections.map((section) => ({
        section: {
          ...section,
          instructorName: section.instructorId ? instructorNameById.get(section.instructorId) ?? null : null,
        },
        occurrences: occurrences
          .filter((occurrence) => occurrence.sectionId === section.id)
          .map((occurrence) => ({
            ...occurrence,
            spotsLeft: Math.max(0, occurrence.capacity - occurrence.confirmedCount),
            myBooking: bookingByOccurrence.get(occurrence.id) ?? null,
          })),
      }));

      setState({ schedule, isLoading: false, error: null });
    } catch (err: any) {
      setState({ schedule: [], isLoading: false, error: err.message || "Błąd ładowania grafiku." });
    }
  }, [gymId, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`schedule-${gymId}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_sections", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_occurrences", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      // Bez filtra: instructors ma własny gym_id, ale realtime payload nie jest tu
      // krytyczny co do świeżości — odświeżenie przy dowolnej zmianie jest tańsze
      // niż drugi, osobny filtr po polu, które i tak rzadko się zmienia.
      .on("postgres_changes", { event: "*", schema: "public", table: "instructors" }, () => fetchAll())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [gymId, fetchAll]);

  return { ...state, refetch: fetchAll };
}
