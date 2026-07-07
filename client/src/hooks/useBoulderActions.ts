/**
 * useBoulderActions — Operacje CRUD na boulderach przez Supabase REST API
 * =========================================================================
 * Używany w trybie admin do dodawania, usuwania i czyszczenia boulderów.
 * Operacje są chronione przez RLS — tylko admin może je wykonać.
 * Jeśli Supabase nie jest skonfigurowany, operacje rzucają błąd.
 */
import { useCallback } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { HoldColorKey, Point } from "../types";

interface AddBoulderParams {
  sectorId: string;
  segmentId: string;
  name: string;
  grade: number;
  holdColor: HoldColorKey;
  author: string;
  position: Point;
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

export function useBoulderActions(gymId: string = WALLER_GYM_ID) {
  /**
   * Dodaj nowy boulder
   */
  const addBoulder = useCallback(
    async (params: AddBoulderParams) => {
      const client = requireSupabase();
      const { data, error } = await client.from("boulders").insert({
        gym_id: gymId,
        sector_id: params.sectorId,
        segment_id: params.segmentId,
        name: params.name,
        grade: params.grade,
        hold_color: params.holdColor,
        author: params.author,
        position: params.position,
        is_active: true,
      }).select().single();

      if (error) throw new Error(error.message);
      return data;
    },
    [gymId]
  );

  /**
   * Usuń boulder (soft delete — ustawia is_active = false)
   */
  const deleteBoulder = useCallback(
    async (boulderId: string) => {
      const client = requireSupabase();
      const { error } = await client
        .from("boulders")
        .update({ is_active: false })
        .eq("id", boulderId);

      if (error) throw new Error(error.message);
    },
    []
  );

  /**
   * Trwale usuń boulder (hard delete)
   */
  const hardDeleteBoulder = useCallback(
    async (boulderId: string) => {
      const client = requireSupabase();
      const { error } = await client
        .from("boulders")
        .delete()
        .eq("id", boulderId);

      if (error) throw new Error(error.message);
    },
    []
  );

  /**
   * Wyczyść wszystkie bouldery w sektorze (soft delete)
   */
  const clearSector = useCallback(
    async (sectorId: string) => {
      const client = requireSupabase();
      const { error } = await client
        .from("boulders")
        .update({ is_active: false })
        .eq("sector_id", sectorId)
        .eq("gym_id", gymId);

      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  return { addBoulder, deleteBoulder, hardDeleteBoulder, clearSector };
}
