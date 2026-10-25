/**
 * useAdminStats — podstawowe statystyki dla panelu admina
 * =============================================================
 * Liczone WYŁĄCZNIE z class_sections/class_occurrences (confirmed_count/
 * waitlisted_count są tam już zdenormalizowane) i instructors (do licznika) —
 * zero zapytań do bookings, więc zero styku z danymi osobowymi klientów.
 *
 * W przeciwieństwie do useClassSchedule bierze WSZYSTKIE terminy (przeszłe
 * i przyszłe), bo statystyki mają sens tylko z historią.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { AdminStats, SectionStats } from "../types";

interface StatsState {
  stats: AdminStats | null;
  isLoading: boolean;
  error: string | null;
}

export function useAdminStats(gymId: string = WALLER_GYM_ID) {
  const [state, setState] = useState<StatsState>({ stats: null, isLoading: true, error: null });

  const fetchStats = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    if (!isSupabaseConfigured || !supabase) {
      setState({ stats: null, isLoading: false, error: "Supabase nie jest skonfigurowany." });
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const [sectionsRes, occurrencesRes, instructorsRes] = await Promise.all([
        supabase.from("class_sections").select("id, name").eq("gym_id", gymId),
        supabase
          .from("class_occurrences")
          .select("id, section_id, starts_at, capacity, confirmed_count, waitlisted_count, status")
          .eq("gym_id", gymId)
          .eq("status", "scheduled"),
        supabase.from("instructors").select("id").eq("gym_id", gymId).eq("is_active", true),
      ]);

      if (sectionsRes.error) throw sectionsRes.error;
      if (occurrencesRes.error) throw occurrencesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      const sections = sectionsRes.data || [];
      const occurrences = occurrencesRes.data || [];

      const bySection: SectionStats[] = sections.map((section: any) => {
        const sectionOccurrences = occurrences.filter((o: any) => o.section_id === section.id);
        const totalConfirmed = sectionOccurrences.reduce((sum: number, o: any) => sum + (o.confirmed_count || 0), 0);
        const totalCapacity = sectionOccurrences.reduce((sum: number, o: any) => sum + (o.capacity || 0), 0);
        return {
          sectionId: section.id,
          sectionName: section.name,
          occurrenceCount: sectionOccurrences.length,
          totalConfirmed,
          totalCapacity,
          occupancyRate: totalCapacity > 0 ? totalConfirmed / totalCapacity : 0,
        };
      });
      bySection.sort((a, b) => b.totalConfirmed - a.totalConfirmed);

      const stats: AdminStats = {
        totalSections: sections.length,
        totalInstructors: (instructorsRes.data || []).length,
        upcomingOccurrenceCount: occurrences.filter((o: any) => o.starts_at >= nowIso).length,
        pastOccurrenceCount: occurrences.filter((o: any) => o.starts_at < nowIso).length,
        totalConfirmedBookings: occurrences.reduce((sum: number, o: any) => sum + (o.confirmed_count || 0), 0),
        totalWaitlisted: occurrences.reduce((sum: number, o: any) => sum + (o.waitlisted_count || 0), 0),
        bySection,
      };

      setState({ stats, isLoading: false, error: null });
    } catch (err: any) {
      setState({ stats: null, isLoading: false, error: err.message || "Błąd ładowania statystyk." });
    }
  }, [gymId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...state, refetch: fetchStats };
}
