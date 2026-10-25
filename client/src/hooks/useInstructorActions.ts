/**
 * useInstructorActions — CRUD instruktorów dla admina (wzorem useSectorActions)
 * =================================================================================
 */
import { useCallback } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

export function useInstructorActions(gymId: string = WALLER_GYM_ID) {
  const addInstructor = useCallback(
    async (name: string, bio: string) => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("instructors")
        .insert({ gym_id: gymId, name: name.trim(), bio: bio.trim() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    [gymId]
  );

  const updateInstructor = useCallback(
    async (instructorId: string, fields: { name?: string; bio?: string; isActive?: boolean }) => {
      const client = requireSupabase();
      const payload: Record<string, unknown> = {};
      if (fields.name !== undefined) payload.name = fields.name.trim();
      if (fields.bio !== undefined) payload.bio = fields.bio.trim();
      if (fields.isActive !== undefined) payload.is_active = fields.isActive;

      const { error } = await client.from("instructors").update(payload).eq("id", instructorId).eq("gym_id", gymId);
      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  /** Usuwa instruktora. class_sections.instructor_id ma ON DELETE SET NULL —
   *  sekcje, które go miały, zostają, tylko tracą przypisanie. */
  const deleteInstructor = useCallback(
    async (instructorId: string) => {
      const client = requireSupabase();
      const { error } = await client.from("instructors").delete().eq("id", instructorId).eq("gym_id", gymId);
      if (error) throw new Error(error.message);
    },
    [gymId]
  );

  return { addInstructor, updateInstructor, deleteInstructor };
}
