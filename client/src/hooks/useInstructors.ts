/**
 * useInstructors — lista instruktorów (odczyt publiczny, wzorem useGymData)
 * =============================================================================
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { Instructor } from "../types";

function mapInstructorRow(row: any): Instructor {
  return {
    id: row.id,
    gymId: row.gym_id,
    name: row.name,
    bio: row.bio || "",
    isActive: row.is_active,
  };
}

export function useInstructors(gymId: string = WALLER_GYM_ID) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setInstructors([]);
      setIsLoading(false);
      setError("Supabase nie jest skonfigurowany.");
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("instructors")
        .select("*")
        .eq("gym_id", gymId)
        .order("sort_order", { ascending: true });

      if (fetchError) throw fetchError;
      setInstructors((data || []).map(mapInstructorRow));
    } catch (err: any) {
      setError(err.message || "Błąd ładowania instruktorów.");
      setInstructors([]);
    } finally {
      setIsLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const channel = supabase
      .channel(`instructors-${gymId}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instructors", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase!.removeChannel(channel);
    };
  }, [gymId, fetchAll]);

  return { instructors, isLoading, error, refetch: fetchAll };
}
