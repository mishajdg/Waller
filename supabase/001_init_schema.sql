-- =============================================================================
-- WALLER TOPLOGGER MAP — Supabase Schema Initialization
-- =============================================================================
-- Ten skrypt tworzy kompletny schemat bazy danych dla aplikacji Waller.
-- Uruchom go w Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- =============================================================================

-- 1. TABELA: gyms (obiekty wspinaczkowe)
-- Pozwala obsługiwać wiele lokalizacji w przyszłości.
CREATE TABLE IF NOT EXISTS public.gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  map_width INT NOT NULL DEFAULT 1000,
  map_height INT NOT NULL DEFAULT 720,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA: sectors (sektory ściany)
CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  polygon JSONB NOT NULL DEFAULT '[]',
  label JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  fill TEXT NOT NULL DEFAULT '#ffffff',
  setting_date DATE,
  removal_date DATE,
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  highlight TEXT CHECK (highlight IN ('new', 'removal', NULL)),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA: wall_segments (segmenty linii ściany)
CREATE TABLE IF NOT EXISTS public.wall_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  start_point JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  end_point JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  angle_label TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA: boulders (bouldery / problemy)
CREATE TABLE IF NOT EXISTS public.boulders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.wall_segments(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  grade INT NOT NULL CHECK (grade >= 1 AND grade <= 10),
  hold_color TEXT NOT NULL DEFAULT 'blue',
  author TEXT NOT NULL DEFAULT '',
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA: user_roles (role użytkowników)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, gym_id)
);

-- =============================================================================
-- INDEKSY
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_sectors_gym ON public.sectors(gym_id);
CREATE INDEX IF NOT EXISTS idx_wall_segments_gym ON public.wall_segments(gym_id);
CREATE INDEX IF NOT EXISTS idx_wall_segments_sector ON public.wall_segments(sector_id);
CREATE INDEX IF NOT EXISTS idx_boulders_gym ON public.boulders(gym_id);
CREATE INDEX IF NOT EXISTS idx_boulders_sector ON public.boulders(sector_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_gym ON public.user_roles(gym_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Włącz RLS na wszystkich tabelach
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wall_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boulders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- GYMS: wszyscy mogą czytać, tylko admin może edytować
-- ---------------------------------------------------------------------------
CREATE POLICY "gyms_read_all" ON public.gyms
  FOR SELECT USING (true);

CREATE POLICY "gyms_insert_admin" ON public.gyms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "gyms_update_admin" ON public.gyms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = gyms.id
    )
  );

-- ---------------------------------------------------------------------------
-- SECTORS: wszyscy mogą czytać, tylko admin danego gym może edytować
-- ---------------------------------------------------------------------------
CREATE POLICY "sectors_read_all" ON public.sectors
  FOR SELECT USING (true);

CREATE POLICY "sectors_insert_admin" ON public.sectors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = sectors.gym_id
    )
  );

CREATE POLICY "sectors_update_admin" ON public.sectors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = sectors.gym_id
    )
  );

CREATE POLICY "sectors_delete_admin" ON public.sectors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = sectors.gym_id
    )
  );

-- ---------------------------------------------------------------------------
-- WALL_SEGMENTS: wszyscy mogą czytać, tylko admin może edytować
-- ---------------------------------------------------------------------------
CREATE POLICY "wall_segments_read_all" ON public.wall_segments
  FOR SELECT USING (true);

CREATE POLICY "wall_segments_insert_admin" ON public.wall_segments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = wall_segments.gym_id
    )
  );

CREATE POLICY "wall_segments_update_admin" ON public.wall_segments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = wall_segments.gym_id
    )
  );

CREATE POLICY "wall_segments_delete_admin" ON public.wall_segments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = wall_segments.gym_id
    )
  );

-- ---------------------------------------------------------------------------
-- BOULDERS: wszyscy mogą czytać, tylko admin może edytować
-- ---------------------------------------------------------------------------
CREATE POLICY "boulders_read_all" ON public.boulders
  FOR SELECT USING (true);

CREATE POLICY "boulders_insert_admin" ON public.boulders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = boulders.gym_id
    )
  );

CREATE POLICY "boulders_update_admin" ON public.boulders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = boulders.gym_id
    )
  );

CREATE POLICY "boulders_delete_admin" ON public.boulders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = boulders.gym_id
    )
  );

-- ---------------------------------------------------------------------------
-- USER_ROLES: użytkownik widzi swoje role, admin może zarządzać
-- ---------------------------------------------------------------------------
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_read_admin" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.gym_id = user_roles.gym_id
    )
  );

CREATE POLICY "user_roles_insert_admin" ON public.user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.gym_id = user_roles.gym_id
    )
  );

-- =============================================================================
-- FUNKCJE POMOCNICZE
-- =============================================================================

-- Funkcja sprawdzająca, czy bieżący użytkownik jest adminem danego gym
CREATE OR REPLACE FUNCTION public.is_admin(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' AND gym_id = p_gym_id
  );
$$;

-- Funkcja zwracająca rolę bieżącego użytkownika dla danego gym
CREATE OR REPLACE FUNCTION public.get_user_role(p_gym_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles
     WHERE user_id = auth.uid() AND gym_id = p_gym_id
     LIMIT 1),
    'anonymous'
  );
$$;

-- =============================================================================
-- TRIGGER: auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_boulders_updated_at
  BEFORE UPDATE ON public.boulders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- REALTIME: włącz publikację zmian dla tabel
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sectors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.boulders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_segments;
