/**
 * useSectorActions — Operacje admin na sektorach przez Supabase REST API
 * ========================================================================
 * Aktualizacja metadanych sektora: daty montażu/demontażu, autor, highlight.
 * Jeśli Supabase nie jest skonfigurowany, operacje rzucają błąd.
 */
import { useCallback } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { SectorHighlight } from "../types";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

export function useSectorActions(gymId: string = WALLER_GYM_ID) {
  /**
   * Aktualizuj metadane sektora
   */
  const updateSectorMeta = useCallback(
    async (
      sectorId: string,
      field: "setting_date" | "removal_date" | "author",
      value: string
    ) => {
      const client = requireSupabase();
      const { error } = await client
        .from("sectors")
        .update({ [field]: value || null })
        .eq("id", sectorId)
        .eq("gym_id", gymId);

      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  /**
   * Zmień highlight sektora (new, removal, null)
   */
  const updateSectorHighlight = useCallback(
    async (sectorId: string, highlight: SectorHighlight | null) => {
      const client = requireSupabase();
      const { error } = await client
        .from("sectors")
        .update({ highlight })
        .eq("id", sectorId)
        .eq("gym_id", gymId);

      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  return { updateSectorMeta, updateSectorHighlight };
}
