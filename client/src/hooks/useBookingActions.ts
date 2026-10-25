/**
 * useBookingActions — zapis i anulowanie rezerwacji klienta
 * =============================================================
 * Wzorem useBoulderActions/useSectorActions: rzuca błąd gdy Supabase nie jest
 * skonfigurowany, komunikat błędu wprost z Supabase (error.message).
 *
 * bookOccurrence NIE przekazuje gym_id ani status — oba wylicza serwerowo
 * trigger public.handle_booking_insert() (patrz supabase/003_class_sections.sql),
 * więc klient nie może ich podstawić.
 */
import { useCallback, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase nie jest skonfigurowany. Ustaw .env.local z kluczami.");
  }
  return supabase;
}

export function useBookingActions() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bookOccurrence = useCallback(
    async (occurrenceId: string, clientName: string, clientPhone: string) => {
      if (!user) {
        throw new Error("Musisz być zalogowany, aby się zapisać.");
      }
      const client = requireSupabase();
      setIsSubmitting(true);
      try {
        const { data, error } = await client
          .from("bookings")
          .insert({
            occurrence_id: occurrenceId,
            client_user_id: user.id,
            client_name: clientName.trim(),
            client_phone: clientPhone.trim(),
          })
          .select()
          .single();

        if (error) {
          // UNIQUE(occurrence_id, client_user_id) w bazie — druga próba zapisu na ten sam termin
          if (error.code === "23505") {
            throw new Error("Jesteś już zapisany na ten termin.");
          }
          throw new Error(error.message);
        }
        return data;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user]
  );

  /** Anulowanie własnej rezerwacji. RLS (WITH CHECK) pozwala klientowi tylko na status='cancelled'. */
  const cancelBooking = useCallback(async (bookingId: string) => {
    const client = requireSupabase();
    setIsSubmitting(true);
    try {
      const { error } = await client.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
      if (error) throw new Error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { bookOccurrence, cancelBooking, isSubmitting };
}
