# Konfiguracja Supabase — Karma Climbing

## Wymagane zmienne środowiskowe

Utwórz plik `.env.local` w katalogu głównym projektu:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_WALLER_GYM_ID=00000000-0000-0000-0000-000000000001
```

## Gdzie znaleźć klucze

1. Otwórz [Supabase Dashboard](https://supabase.com/dashboard)
2. Wybierz swój projekt
3. Kliknij **Settings** (lewy panel) → **API**
4. Skopiuj:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## Kolejność uruchamiania SQL

1. `001_init_schema.sql` — tworzy tabele, RLS, triggery
2. `002_seed_karma_demo.sql` — wstawia dane demo (12 sektorów, 18 segmentów, 25 boulderów)

## Fallback

Jeśli `.env.local` nie istnieje lub klucze są placeholderami, aplikacja automatycznie
używa danych lokalnych z `client/src/data/gymMap.ts` (tryb offline/demo).
