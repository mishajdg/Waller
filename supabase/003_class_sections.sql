-- =============================================================================
-- 003_class_sections.sql — Moduł rezerwacji sekcji wspinaczkowych
-- =============================================================================
-- Skorygowane po sklonowaniu i weryfikacji github.com/mishajdg/Waller (2026-09-27):
--   - repo ma tylko 001_init_schema.sql i 002_seed_karma_demo.sql → to jest
--     naturalnie 003, nie 005/004 jak w poprzednim draftcie
--   - is_admin(p_gym_id) i update_updated_at() już istnieją w 001 → reużyte,
--     nie redefiniowane
--   - user_roles.role ma CHECK (role IN ('admin','viewer')) i BRAK insert
--     policy dla zwykłego usera → NIE dotykamy user_roles w ogóle.
--     AuthContext.fetchRole() już domyślnie traktuje każdego zalogowanego
--     usera bez wiersza w user_roles jako 'viewer', więc self-service klient
--     działa "za darmo" przez zwykłe supabase.auth.signUp() — bez żadnych
--     zmian w user_roles/RLS.
--   - gym_id w bookings jest teraz wyliczane SERWEROWO w triggerze na
--     podstawie class_occurrences (klient nie może go podstawić/sfałszować)
--
-- Rewizja przy budowie widoku grafiku (2026-09-29):
--   - dodano confirmed_count/waitlisted_count na class_occurrences + trigger
--     przeliczający je i automatycznie awansujący z listy oczekujących —
--     bez tego klient nie mógłby zobaczyć zajętości (RLS na bookings
--     ogranicza SELECT do własnego wiersza)
--   - dodano WITH CHECK do bookings_update_own_or_admin: bez niego klient
--     mógłby sam sobie zmienić status z 'waitlisted' na 'confirmed'
--     (przeskoczenie kolejki) — teraz może tylko anulować własną rezerwację
--
-- Uruchom w Supabase SQL Editor PO 001 i 002.
-- =============================================================================

-- 1. TABELA: class_sections (definicja oferty — grupa cykliczna albo dropin)
CREATE TABLE IF NOT EXISTS public.class_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'recurring' CHECK (kind IN ('recurring', 'dropin')),
  instructor TEXT NOT NULL DEFAULT '',
  default_capacity INT NOT NULL DEFAULT 8 CHECK (default_capacity > 0),
  price_info TEXT NOT NULL DEFAULT '', -- np. "50 zł / zajęcia" — informacyjnie, bez integracji płatności
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA: class_occurrences (konkretne terminy zajęć)
-- Dla 'recurring': generujemy wiele rekordów naprzód (np. 8 tyg.)
-- Dla 'dropin': każdy termin dodawany ręcznie przez admina
CREATE TABLE IF NOT EXISTS public.class_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.class_sections(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  -- Zliczenia denormalizowane, utrzymywane triggerem na bookings (patrz niżej).
  -- Powód: RLS na bookings ogranicza SELECT do własnego wiersza klienta lub admina,
  -- więc zwykły klient nie policzy zajętości sam z tabeli bookings — musi dostać
  -- gotową, publicznie czytelną liczbę stąd.
  confirmed_count INT NOT NULL DEFAULT 0,
  waitlisted_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA: bookings (zapis klienta na konkretny termin)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE, -- wypełniane triggerem, nie przez klienta
  occurrence_id UUID NOT NULL REFERENCES public.class_occurrences(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, client_user_id)
);

-- =============================================================================
-- INDEKSY
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_class_sections_gym ON public.class_sections(gym_id);
CREATE INDEX IF NOT EXISTS idx_class_occurrences_gym ON public.class_occurrences(gym_id);
CREATE INDEX IF NOT EXISTS idx_class_occurrences_section ON public.class_occurrences(section_id);
CREATE INDEX IF NOT EXISTS idx_class_occurrences_starts_at ON public.class_occurrences(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_occurrence ON public.bookings(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON public.bookings(client_user_id);

-- =============================================================================
-- TRIGGER: wypełnia gym_id serwerowo + pilnuje limitu miejsc (waitlist)
-- Liczenie w triggerze (nie w kliencie) chroni przed race condition przy
-- dwóch klientach zapisujących się w tej samej sekundzie, a wyliczanie
-- gym_id z occurrence (nie z inputu klienta) zapobiega podstawieniu złego gym_id.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_booking_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity INT;
  v_gym_id UUID;
  v_confirmed_count INT;
BEGIN
  SELECT capacity, gym_id INTO v_capacity, v_gym_id
  FROM public.class_occurrences
  WHERE id = NEW.occurrence_id AND status = 'scheduled';

  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'class_occurrences % nie istnieje albo jest odwołane', NEW.occurrence_id;
  END IF;

  NEW.gym_id := v_gym_id;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.bookings
  WHERE occurrence_id = NEW.occurrence_id AND status = 'confirmed';

  IF v_confirmed_count >= v_capacity THEN
    NEW.status := 'waitlisted';
  ELSE
    NEW.status := 'confirmed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_booking_insert ON public.bookings;
CREATE TRIGGER trg_handle_booking_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_insert();

-- ============================================================
-- Trigger: przelicza confirmed_count/waitlisted_count na class_occurrences
-- po KAŻDEJ zmianie w bookings (insert, zmiana statusu) i — jeśli zwolniło
-- się miejsce (np. po anulowaniu) — automatycznie awansuje najstarszą osobę
-- z listy oczekujących na 'confirmed' (rekurencyjnie odpala samego siebie
-- dla tego UPDATE i kończy przeliczeniem finalnych liczb; pętla jest
-- skończona, bo za każdym przebiegiem albo brakuje miejsca, albo listy
-- oczekujących). Znany limit: ręczne zwiększenie capacity w class_occurrences
-- nie odpala tego triggera — awans nastąpi dopiero przy najbliższej zmianie
-- w bookings dla tego terminu.
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_occurrence_counts_and_promote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_occurrence_id UUID := COALESCE(NEW.occurrence_id, OLD.occurrence_id);
  v_capacity INT;
  v_confirmed INT;
  v_waitlisted INT;
  v_promote_id UUID;
BEGIN
  SELECT capacity INTO v_capacity
  FROM public.class_occurrences
  WHERE id = v_occurrence_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'waitlisted')
  INTO v_confirmed, v_waitlisted
  FROM public.bookings
  WHERE occurrence_id = v_occurrence_id;

  IF v_confirmed < v_capacity AND v_waitlisted > 0 THEN
    SELECT id INTO v_promote_id
    FROM public.bookings
    WHERE occurrence_id = v_occurrence_id AND status = 'waitlisted'
    ORDER BY created_at
    LIMIT 1;

    IF v_promote_id IS NOT NULL THEN
      UPDATE public.bookings SET status = 'confirmed' WHERE id = v_promote_id;
      -- powyższy UPDATE odpalił ten trigger ponownie i zapisał już finalne,
      -- aktualne liczniki — nie nadpisujemy ich tutaj nieaktualnymi wartościami
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  UPDATE public.class_occurrences
  SET confirmed_count = v_confirmed, waitlisted_count = v_waitlisted
  WHERE id = v_occurrence_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_occurrence_counts ON public.bookings;
CREATE TRIGGER trg_refresh_occurrence_counts
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_occurrence_counts_and_promote();

-- Reużyty trigger z 001_init_schema.sql (funkcja update_updated_at już istnieje)
CREATE TRIGGER trg_class_sections_updated_at
  BEFORE UPDATE ON public.class_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- CLASS_SECTIONS: wszyscy mogą czytać, tylko admin danego gym może edytować
-- (używa is_admin() zdefiniowanego w 001 — funkcjonalnie identyczne z
--  wzorcem EXISTS(...) użytym w politykach dla sectors/boulders)
-- ---------------------------------------------------------------------------
CREATE POLICY "class_sections_read_all" ON public.class_sections
  FOR SELECT USING (true);

CREATE POLICY "class_sections_insert_admin" ON public.class_sections
  FOR INSERT WITH CHECK (is_admin(gym_id));

CREATE POLICY "class_sections_update_admin" ON public.class_sections
  FOR UPDATE USING (is_admin(gym_id));

CREATE POLICY "class_sections_delete_admin" ON public.class_sections
  FOR DELETE USING (is_admin(gym_id));

-- ---------------------------------------------------------------------------
-- CLASS_OCCURRENCES: wszyscy mogą czytać, tylko admin może edytować
-- ---------------------------------------------------------------------------
CREATE POLICY "class_occurrences_read_all" ON public.class_occurrences
  FOR SELECT USING (true);

CREATE POLICY "class_occurrences_insert_admin" ON public.class_occurrences
  FOR INSERT WITH CHECK (is_admin(gym_id));

CREATE POLICY "class_occurrences_update_admin" ON public.class_occurrences
  FOR UPDATE USING (is_admin(gym_id));

CREATE POLICY "class_occurrences_delete_admin" ON public.class_occurrences
  FOR DELETE USING (is_admin(gym_id));

-- ---------------------------------------------------------------------------
-- BOOKINGS: klient widzi/tworzy/aktualizuje tylko swoje; admin widzi/zarządza
-- wszystkimi dla swojego gym. Brak DELETE policy celowo — anulowanie to
-- UPDATE status='cancelled', nie usunięcie wiersza (historia zostaje).
-- ---------------------------------------------------------------------------
CREATE POLICY "bookings_select_own_or_admin" ON public.bookings
  FOR SELECT USING (client_user_id = auth.uid() OR is_admin(gym_id));

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "bookings_update_own_or_admin" ON public.bookings
  FOR UPDATE USING (client_user_id = auth.uid() OR is_admin(gym_id))
  -- Bez WITH CHECK klient mógłby UPDATE-em ustawić sobie status='confirmed'
  -- z 'waitlisted' (przeskoczenie kolejki). Klient może więc zmienić TYLKO
  -- swój wiersz na 'cancelled' — każdą inną zmianę (w tym confirmed/waitlisted)
  -- może zrobić wyłącznie admin.
  WITH CHECK (
    is_admin(gym_id)
    OR (client_user_id = auth.uid() AND status = 'cancelled')
  );

-- =============================================================================
-- REALTIME: pozwala klientom widzieć zmiany dostępności miejsc na żywo
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_occurrences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
