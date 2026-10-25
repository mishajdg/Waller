/**
 * useClassSectionActions — CRUD sekcji (class_sections) dla admina
 * =====================================================================
 */
import { useCallback } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { SectionKind } from "../types";

export interface ClassSectionDraft {
  name: string;
  description: string;
  kind: SectionKind;
  instructorId: string | null;
  defaultCapacity: number;
  priceInfo: string;
  isActive: boolean;
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

const toRow = (draft: ClassSectionDraft) => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  kind: draft.kind,
  instructor_id: draft.instructorId,
  default_capacity: draft.defaultCapacity,
  price_info: draft.priceInfo.trim(),
  is_active: draft.isActive,
});

export function useClassSectionActions(gymId: string = WALLER_GYM_ID) {
  const addSection = useCallback(
    async (draft: ClassSectionDraft) => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("class_sections")
        .insert({ gym_id: gymId, ...toRow(draft) })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    [gymId]
  );

  const updateSection = useCallback(
    async (sectionId: string, draft: ClassSectionDraft) => {
      const client = requireSupabase();
      const { error } = await client.from("class_sections").update(toRow(draft)).eq("id", sectionId).eq("gym_id", gymId);
      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  /** Dezaktywacja zamiast twardego usunięcia — zniknie z grafiku (is_active=false
   *  jest w WHERE useClassSchedule), ale historia terminów/rezerwacji zostaje. */
  const setSectionActive = useCallback(
    async (sectionId: string, isActive: boolean) => {
      const client = requireSupabase();
      const { error } = await client
        .from("class_sections")
        .update({ is_active: isActive })
        .eq("id", sectionId)
        .eq("gym_id", gymId);
      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  return { addSection, updateSection, setSectionActive };
}
