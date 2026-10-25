# AGENTS.md — Waller (Karma Climbing)

> Zweryfikowane bezpośrednio z `github.com/mishajdg/Waller` (klon + pełny `view` kluczowych
> plików, nie tylko nagłówki) — 2026-09-30, zaktualizowane 2026-10-01 po dodaniu panelu admina,
> instruktorów, treningów indywidualnych i statystyk. Ten plik jest pisany z myślą o agencie kodującym
> (Codex, Claude Code itp.) pracującym w VS Code nad tym repo. Jeśli jesteś takim agentem:
> **ten projekt bywa rozwijany równolegle, poza Twoją sesją.** Nie zakładaj, że plik wygląda
> tak, jak opisano niżej, tylko dlatego, że nagłówek komentarza albo liczba linii się zgadza —
> zrób pełny `view`/`cat` pliku, zanim go zmienisz. Sekcja "Pułapki" na końcu wyjaśnia dlaczego.

## Co to jest

Interaktywna mapa SVG ścianki wspinaczkowej dla siłowni Karma (branding "Karma", nazwa repo
"Waller"). Klient skanuje QR, widzi mapę sektorów i boulderów (read-only), admin loguje się i
zarządza metadanymi sektorów oraz boulderami. Od 2026-09-27 budowany jest drugi, niezależny
moduł: rezerwacja miejsc na sekcje wspinaczkowe (grupy cykliczne + dropiny), styl Booksy.

Produkcja: **waller-phi.vercel.app** (Vercel, SPA z pełnym rewrite do `index.html` — patrz
`vercel.json`). Repo GitHub jest prywatne.

## Stack

- React 19 + TypeScript (strict) + Vite 7, Tailwind v4 (`@tailwindcss/vite`, bez `tailwind.config` —
  konfiguracja przez `@import "tailwindcss"` w `index.css`)
- Supabase (Postgres + Auth + Realtime) jako jedyny backend — brak własnego serwera/API
- `wouter` do routingu (lekki, bez wymaganego `<Router>` wrapper)
- Radix UI + shadcn-style prymitywy w `components/ui/` (niezmieniane, standardowe)
- `vaul` (bottom drawer), `embla-carousel-react`, `framer-motion`, `recharts`, `react-hook-form`
  są w `package.json`, ale poza drawerem reszta nie jest jeszcze użyta w kodzie aplikacji
- Package manager: **pnpm 10.4.1** (przypięty w `packageManager`), Node 22 działał w testach
- Brak CI (`.github/` nie istnieje), brak `.env.example`

## Jak odpalić

```bash
pnpm install
cp /dev/null .env.local   # patrz zmienne niżej — brak .env.example w repo
pnpm dev                  # vite dev server, port 5173
pnpm run check            # tsc --noEmit
pnpm build                # vite build -> dist/
```

Wymagane zmienne w `.env.local` (czytane przez `client/src/lib/supabase.ts`, prefiks `VITE_`
bo to Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WALLER_GYM_ID` (opcjonalne — ma fallback na stałe demo UUID)

Bez tych zmiennych (albo z placeholderami) `isSupabaseConfigured` jest `false` i **cała mapa**
(sektory/bouldery/segmenty) renderuje się z danych lokalnych w `client/src/data/gymMap.ts` —
to zamierzony tryb offline/demo, nie błąd. Moduł rezerwacji (`ScheduleView`) **nie ma** takiego
fallbacku — bez Supabase pokaże tylko komunikat o braku konfiguracji.

## Struktura repo (to, co ma znaczenie)

```
supabase/
  001_init_schema.sql       — gyms, sectors, wall_segments, boulders, user_roles + RLS + is_admin()/get_user_role()
  002_seed_karma_demo.sql   — dane demo
  003_class_sections.sql    — moduł rezerwacji: class_sections, class_occurrences, bookings + triggery
  004_instructors.sql       — instruktorzy jako encja (FK instructor_id), kind += 'individual'
                              ZALEŻY od 003. Oba napisane i zweryfikowane składniowo (pglast/
                              libpg_query), ALE NIE URUCHOMIONE na żadnym realnym Supabase —
                              uruchom w kolejności 003, potem 004.

client/src/
  App.tsx                   — cienki router wouter: "/" i "/admin" -> MapPage, "/zajecia" ->
                              ScheduleView, "/admin/zajecia" -> AdminSchedulePage
  main.tsx                  — createRoot + <AuthProvider><App /></AuthProvider>, bez zmian
  types.ts                  — WSZYSTKIE typy domenowe (mapa + rezerwacje) w jednym pliku
  types/supabase.ts         — ręcznie pisany Database interface — UWAGA: supabase.ts NIE używa
                              go generycznie (`createClient(url, key)` bez `<Database>`), więc
                              to typowanie jest dokumentacyjne, nie wymuszane przez tsc na
                              wywołaniach supabase.from(...)
  lib/supabase.ts           — klient Supabase, isSupabaseConfigured
  lib/geometry.ts           — pointInPolygon, getSectorAtPoint (iteruje po sector.polygons[])
  lib/boulderLayout.ts      — auto-layout pinów wzdłuż segmentów z "main" w nazwie, sortowanie wg grade

  contexts/AuthContext.tsx  — sesja Supabase + rola (admin/viewer/anonymous) + signIn/signUp/signOut
  components/LoginForm.tsx  — variant="admin" (domyślny, bramka /admin) | variant="client"
  components/RegisterForm.tsx, AuthDialog.tsx, AuthForms.css — rejestracja klienta (nowe, 2026-09-29)

  pages/MapPage.tsx         — cała dotychczasowa logika mapy (ex-App.tsx), bez zmian poza
                              routingiem i linkami "Zajęcia" / "Zarządzaj zajęciami" (admin) w nagłówku
  pages/ScheduleView.tsx(+.css) — grafik sekcji (publiczny): zapis/lista oczekujących/anulowanie
  pages/AdminSchedulePage.tsx(+.css) — panel admina: 4 zakładki (Sekcje/Terminy/Instruktorzy/
                              Statystyki), gate przez isAdmin z AuthContext (ta sama sesja co
                              bramka /admin na mapie, bez osobnego logowania)
  components/WallMap.tsx    — render SVG mapy (821 linii) — patrz niżej, sporo się tu dzieje
  components/InspectorPanel.tsx — panel szczegółów sektora/bouldera, BEZ zmian

  data/gymMap.ts            — źródło danych lokalnych: sectors, wallSegments, matLines (868 linii)
  data/polygonStyles.ts     — depthToFill(depth): 0-4 = odcienie szarości wg "głębi" ściany,
                              100 = sentinel "niewidoczny hitbox" (prawie przezroczysty)
  data/lineStyles.ts        — getSegmentImportance(name): "main"/"pdst" w nazwie = primary
                              (grubsza, ciemniejsza linia), reszta = secondary
  data/decorativeLabels.ts  — statyczne etykiety na mapie (SIŁOWNIA, Recepcja, strzałki)
  data/backgroundPolygons.ts — zarezerwowana warstwa dekoracyjnych poligonów, obecnie PUSTA
                              (wszystkie wpisy zakomentowane)

  hooks/useGymData.ts           — fetch + realtime + fallback na gymMap.ts (wzorzec bazowy)
  hooks/useBoulderActions.ts, useSectorActions.ts — CRUD admina mapy (rzuca błąd gdy Supabase nie skonfigurowany)
  hooks/useClassSchedule.ts     — sekcje (z dociągniętym instructorName) + nadchodzące terminy +
                                  własne rezerwacje klienta, realtime; eksportuje mapSectionRow/
                                  mapOccurrenceRow — reużyte przez AdminSchedulePage, żeby nie
                                  duplikować mapowania wiersz->typ
  hooks/useBookingActions.ts    — bookOccurrence / cancelBooking (klient)
  hooks/useInstructors.ts       — lista instruktorów, odczyt publiczny, realtime
  hooks/useInstructorActions.ts, useClassSectionActions.ts, useClassOccurrenceActions.ts — CRUD
                                  admina dla nowych encji, ten sam wzorzec co useSectorActions
  hooks/useClassOccurrenceActions.ts — UWAGA: generateWeeklyOccurrences (generator cyklicznych
                                  terminów) musi dodawać tygodnie przez Date.setDate(), NIE przez
                                  "+7*86400000 ms" — ta druga metoda psuje godzinę lokalną przy
                                  zmianie czasu letni/zimowy (zweryfikowane empirycznie dla
                                  Europe/Warsaw: "wtorek 18:00" przed 25.10.2026 stawało się
                                  "17:00" po tej dacie przy liczeniu w ms). Kod już to robi
                                  poprawnie — nie "upraszczaj" z powrotem do arytmetyki ms.
  hooks/useAdminStats.ts        — statystyki liczone WYŁĄCZNIE z class_sections/class_occurrences
                                  (confirmed_count/waitlisted_count już tam są) — celowo zero
                                  zapytań do bookings, żeby nie dotykać danych osobowych klientów
```

## Model danych

### Istniejące (migracje 001+002, działa produkcyjnie)
`gyms` → `sectors` (polygons: wiele poligonów na sektor, każdy z `depth`; `cameraOffset`,
`zoomScale` per-sektor dla zoomu) → `wall_segments` (linie ścian, `name` zawierający
"main"/"pdst" = segment strukturalny) → `boulders`. Osobno `user_roles` (`role: admin|viewer`,
unikalny per `user_id`+`gym_id`). Funkcje pomocnicze `is_admin(p_gym_id)` i
`get_user_role(p_gym_id)` (SECURITY DEFINER) — zdefiniowane w 001, ale RLS samych tabel
`sectors`/`boulders`/`wall_segments` używa inline `EXISTS(...)`, nie tych funkcji (moduł
rezerwacji w 003 jako pierwszy faktycznie z nich korzysta).

**12 sektorów** (stałe id/code, geometria bywa edytowana): Slab(s01), Prawy compwall(s02), Lewy
compwall(s03), Prawy dach(s04), Lewy dach(s05), Beczka(s06), Logo(s07), Czujny pion(s08), Mały
przewis(s09), Średni przewis(s10), Duży przewis(s11), Spraywall(s12). 82 `wall_segments`.

### Nowe — moduł rezerwacji (003+004, NAPISANE, NIE URUCHOMIONE)
`instructors` (encja: imię, bio, aktywność — 004) ← `class_sections` (oferta: nazwa,
`kind: recurring|dropin|individual`, `instructor_id` FK do `instructors` [`ON DELETE SET NULL`,
NIE wolny tekst — tekstowa kolumna `instructor` z 003 została w 004 USUNIĘTA, `DROP COLUMN`],
cena jako wolny tekst — **bez integracji płatności, celowo**) → `class_occurrences` (konkretne
terminy; `confirmed_count` / `waitlisted_count` **denormalizowane i utrzymywane triggerem**, nie
liczone z `bookings` na żywo — bo RLS na `bookings` i tak by tego klientowi nie pozwoliło) →
`bookings` (`client_user_id` to zwykły `auth.users.id`, **żadnego osobnego wiersza w
`user_roles`** — klient to po prostu zalogowany użytkownik Supabase). Trening indywidualny
(`kind='individual'`) to zwykła sekcja z `capacity=1` na jej terminach — reużywa całej
maszynerii grupowej, nie ma osobnej ścieżki kodu.

Dwa triggery robią całą robotę:
1. `handle_booking_insert` (BEFORE INSERT) — wylicza `gym_id` z `class_occurrences` (klient go
   nie podaje, nie może sfałszować) i ustawia status `confirmed`/`waitlisted` wg aktualnej
   zajętości.
2. `refresh_occurrence_counts_and_promote` (AFTER INSERT/UPDATE OF status) — przelicza liczniki
   i **automatycznie awansuje** najstarszą osobę z listy oczekujących, gdy zwolni się miejsce
   (np. po anulowaniu). Rekurencyjny (promocja to UPDATE, które samo siebie odpala ponownie),
   ale skończony. **Znany limit:** ręczna zmiana `capacity` nie odpala tego triggera.

RLS na `bookings`: klient widzi/tworzy tylko swój wiersz; `WITH CHECK` pozwala klientowi
zmienić własny status WYŁĄCZNIE na `cancelled` (bez tego mógłby sam się "awansować" z
`waitlisted` na `confirmed`).

## Auth — trzy poziomy

`AuthContext` (`role: "admin" | "viewer" | "anonymous"`):
- **anonymous** — brak sesji
- **viewer** — zalogowany Supabase user BEZ wiersza w `user_roles` dla tego `gym_id`
  (`fetchRole()` używa `.maybeSingle()` i domyślnie zwraca `"viewer"`) — **to jest klient
  modułu rezerwacji**, żadnej specjalnej logiki poza zwykłym `supabase.auth.signUp()`
- **admin** — jawny wiersz `role='admin'` w `user_roles`

Bramka admina: `isAdminEntry()` sprawdza WYŁĄCZNIE `window.location.pathname === "/admin"`
(nie query string). `/admin` jest zarejestrowane jako osobna route w `App.tsx` wskazująca na
TEN SAM `MapPage` — to nie osobny widok, `MapPage` sam decyduje co pokazać na podstawie
pathname.

## Co jest zrobione vs. do zrobienia (moduł rezerwacji)

**Frontend — gotowe:** logowanie/rejestracja klienta z obsługą potwierdzenia e-mail,
`ScheduleView` (lista sekcji, zapis, lista oczekująca, anulowanie, realtime), `AdminSchedulePage`
(CRUD sekcji/instruktorów, dodawanie terminów pojedynczo LUB generator cykliczny co tydzień,
anulowanie terminu, zakładka statystyk), routing i nawigacja między wszystkimi trzema widokami
wpięte.

**Backend — gotowe:** migracje 003+004 napisane i zweryfikowane składniowo (`pglast`, 48
instrukcji łącznie). Logika biznesowa nietrywialna, nie tylko CRUD: auto-promocja z listy
oczekujących, `cancelOccurrence` kaskadowo anuluje też aktywne rezerwacje na tym terminie,
generator cykliczny poprawnie liczy przez zmianę czasu (patrz uwaga przy
`useClassOccurrenceActions` wyżej).

**Świadomie NIEzaimplementowane (nie traktuj jako przeoczenie):**
- **Płatności** — użytkownik jawnie zdecydował "na razie płatność na miejscu" (2026-09-27, patrz
  `price_info` jako wolny tekst). Jeśli to się zmieniło, to osobna, duża decyzja (wybór
  dostawcy — Stripe/Przelewy24/P24 — konto, webhooki jako Supabase Edge Function, zgodność
  księgowa dla JDG) — nie zgaduj dostawcy i nie buduj częściowej/fasadowej integracji.
- **Powiadomienia SMS/e-mail** — e-mail przy rejestracji już działa (Supabase Auth, confirm
  link). Powiadomienia o rezerwacji (potwierdzenie, promocja z listy oczekujących, anulowanie
  przez admina) **nie istnieją** poza tym, co realtime pokaże klientowi, gdy ma akurat otwartą
  kartę w przeglądarce. Wymaga wyboru dostawcy (SMSAPI.pl, Twilio, Resend...) + Supabase Edge
  Function — nie zgaduj, zapytaj najpierw.

**Co jeszcze brakuje poza tym (zwykły dług, nie decyzje strategiczne):**
- uruchomienie 003 i 004 na faktycznym Supabase (w tej kolejności) — wciąż nie zrobione
- ustawienie "Confirm email" + Redirect URL `waller-phi.vercel.app` (`signUp()` wysyła
  `emailRedirectTo: window.location.origin`)
- pierwsze realne dane (instruktorzy/sekcje/terminy) — po migracji można je wstawić przez
  `AdminSchedulePage`, NIE trzeba już ręcznie w Supabase Studio

## Pułapki / rzeczy warte uwagi

1. **Ten repo jest rozwijany równolegle poza tą sesją.** `gymMap.ts`/`WallMap.tsx`/`types.ts`
   okazały się dużo bardziej rozwinięte niż migawka wklejona wcześniej na czacie, z którego
   powstał ten plik — zanim zaczniesz coś zmieniać, zrób świeży `git pull`/`view`, nie ufaj
   opisom "na pamięć".
2. `boulderPins` w `gymMap.ts` to teraz pusta tablica (`[]`) — tryb offline/demo nie pokaże
   żadnych pinów boulderów (tylko sektory i linie).
3. `decorativeLabels.ts` ma zduplikowane wpisy (każda etykieta występuje dwa razy) — wygląda
   na przypadkowy copy-paste, nieszkodliwe (SVG po prostu narysuje to samo dwa razy), ale warto
   posprzątać przy okazji.
4. `SectorHighlightStyle`/`SectorHighlightMode`/`SectorHighlightUnderline` są zdefiniowane w
   `types.ts`, ale **nigdzie nie są jeszcze użyte** — to szkielet pod funkcję, która jeszcze nie
   istnieje, nie brakujące podłączenie czegoś gotowego.
5. `useGymData.ts` ma kilka zostawionych `console.log` — nieszkodliwe, ale warto wyczyścić.
6. Link "Tryb klient" w nagłówku mapy wskazywał kiedyś `href="?admin=1"`, co nigdy nie
   włączało trybu admina (bo `isAdminEntry()` sprawdza tylko pathname) — już naprawione na
   `href="/admin"` w ramach prac nad routingiem 2026-09-30.
7. `.login-*` oraz `.loading-screen` to klasy CSS używane w komponentach, które **nie miały
   żadnych definicji** w `index.css` — pierwsze naprawiono (`AuthForms.css`), `.loading-screen`
   wciąż czeka (dotyczy ekranów ładowania/błędu w `MapPage.tsx`).
8. Zero testów w repo poza tymczasowymi (nieukończonymi) plikami pisanymi doraźnie podczas
   weryfikacji zmian w tej sesji — nie ma stałego test suite do uruchomienia.
9. `004_instructors.sql` robi `DROP COLUMN IF EXISTS instructor` na `class_sections` — jeśli
   ktoś UŻ uruchomił 003 i ręcznie wpisał dane w tę kolumnę ZANIM 004 poszło, te dane giną
   bezpowrotnie. Dziś to martwy scenariusz (nic jeszcze nie jest uruchomione), ale jeśli w
   międzyczasie ktoś odpalił tylko 003 i dodał sekcje — ostrzeż przed uruchomieniem 004 na
   tamtej bazie bez sprawdzenia.
10. `cancelOccurrence` (admin, `useClassOccurrenceActions`) kasuje nie tylko termin, ale też
    WSZYSTKIE aktywne rezerwacje na nim (status -> cancelled) — i **nie wysyła żadnego
    powiadomienia** klientowi. Z perspektywy klienta jego rezerwacja po prostu zniknie przy
    następnym odświeżeniu/evencie realtime.

## Jeśli kontynuujesz pracę nad modułem rezerwacji

Kolejność ma znaczenie — każdy krok zależy od poprzedniego:
1. Uruchom `supabase/003_class_sections.sql`, potem `supabase/004_instructors.sql` (w tej
   kolejności — 004 zależy od tabel z 003) na realnym projekcie Supabase
2. Ustaw "Confirm email" (Authentication settings) i Redirect URL dla `waller-phi.vercel.app`
3. `pnpm install && pnpm run check && pnpm build` — złap literówki/błędy typów zanim cokolwiek
   odpalisz w przeglądarce
4. Zaloguj się jako admin (`/admin`) → "Zarządzaj zajęciami" → dodaj 1 instruktora, 1-2 sekcje
   (w tym spróbuj `kind="individual"`), kilka terminów (spróbuj generatora cyklicznego, nie
   tylko pojedynczego) — wszystko przez UI, nie ręcznie w Supabase Studio
5. Przetestuj cały przepływ end-to-end jako klient (`/zajecia`): rejestracja → zapis → termin
   pełny po kilku zapisach → lista oczekujących → anulowanie przez klienta → automatyczny
   awans → anulowanie terminu przez admina (sprawdź, czy rezerwacje faktycznie się anulowały)
6. Dopiero po tym punkt wyjścia do rozmowy z użytkownikiem o płatnościach i powiadomieniach —
   patrz "Świadomie NIEzaimplementowane" wyżej, to decyzje, nie brakujący kod
