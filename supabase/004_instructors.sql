-- =============================================================================
-- 004_instructors.sql — Instruktorzy jako encja + treningi indywidualne
-- =============================================================================
-- Zależy od 003_class_sections.sql (class_sections musi już istnieć).
-- Wciąż NIEURUCHOMIONE na żadnym realnym Supabase na dzień pisania tego pliku
-- (sprawdź current-state.md w pamięci projektu, jeśli czytasz to później).
--
-- Co robi:
--   1. Nowa tabela instructors (imię, bio, aktywność)
--   2. class_sections.instructor -> instructor_id (FK), bo wolny tekst nie
--      pozwalał np. pokazać jednego instruktora spójnie w kilku sekcjach
--   3. kind += 'individual' — treningi 1:1 reużywają całej istniejącej
--      maszynerii capacity/waitlist z 003 (capacity=1, ta sama ścieżka
--      bookOccurrence/cancelBooking co dla grup)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructors_gym ON public.instructors(gym_id);

CREATE TRIGGER trg_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructors_read_all" ON public.instructors
  FOR SELECT USING (true);

CREATE POLICY "instructors_insert_admin" ON public.instructors
  FOR INSERT WITH CHECK (is_admin(gym_id));

CREATE POLICY "instructors_update_admin" ON public.instructors
  FOR UPDATE USING (is_admin(gym_id));

CREATE POLICY "instructors_delete_admin" ON public.instructors
  FOR DELETE USING (is_admin(gym_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.instructors;

-- =============================================================================
-- class_sections: wolny tekst "instructor" -> FK "instructor_id"
-- =============================================================================
ALTER TABLE public.class_sections DROP COLUMN IF EXISTS instructor;
ALTER TABLE public.class_sections
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_sections_instructor ON public.class_sections(instructor_id);

-- =============================================================================
-- class_sections.kind: 'recurring' | 'dropin' -> + 'individual'
-- Nazwa ograniczenia to domyślna, auto-nadana przez Postgres dla CHECK na
-- kolumnie zdefiniowanego bez jawnego CONSTRAINT w CREATE TABLE (003):
-- <tabela>_<kolumna>_check. Jeśli w Twojej bazie jest inna (np. po ręcznej
-- zmianie), sprawdź: SELECT conname FROM pg_constraint WHERE conrelid =
-- 'public.class_sections'::regclass AND contype = 'c';
-- =============================================================================
ALTER TABLE public.class_sections DROP CONSTRAINT IF EXISTS class_sections_kind_check;
ALTER TABLE public.class_sections
  ADD CONSTRAINT class_sections_kind_check CHECK (kind IN ('recurring', 'dropin', 'individual'));
