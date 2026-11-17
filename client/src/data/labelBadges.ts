/**
 * Pigułki „nowe" / „stare" oraz licznik ⬡ × N przy nazwie sektora — USTAWIENIA.
 * Odległości są w „em": 1 em = rozmiar czcionki nazwy sektora, więc wszystko skaluje się razem z mapą.
 * Geometrię liczy components/SectorLabel.tsx — tutaj zmieniasz tylko liczby.
 */
export type BadgePlacement = "below" | "above" | "left" | "right";

export type BadgeStyle = {
  placement: BadgePlacement; // gdzie względem nazwy sektora: pod / nad / z lewej / z prawej
  scale: number;             // rozmiar: 1 = domyślny, 1.25 = o 25% większy, 0.8 = mniejszy
  gap: number;               // odstęp od nazwy (em)
  dx: number;                // dosunięcie w prawo (em); wartość ujemna = w lewo
  dy: number;                // dosunięcie w dół (em); wartość ujemna = w górę
};

// Teksty pigułek i ich szerokość w em (przy scale = 1). Dłuższy tekst = większa szerokość.
export const SECTOR_PILLS = {
  new: { text: "nowe", width: 3.2 },
  removal: { text: "stare", width: 3.6 },
} as const;

// Ustawienia domyślne — dla wszystkich sektorów
export const PILL_DEFAULT: BadgeStyle = { placement: "right", scale: 0.85, gap: 0.5, dx: 0, dy: 0 };
export const COUNTER_DEFAULT: BadgeStyle = { placement: "below", scale: 1.4, gap: 0.15, dx: 0, dy: 0 };

// Wyjątki dla pojedynczych sektorów: klucz = id sektora z gymMap.ts (np. "s06"),
// wartość = tylko te parametry, które chcesz zmienić.
export const PILL_OVERRIDES: Record<string, Partial<BadgeStyle>> = {
  s01: { placement: "right" }, // Slab — przy prawej krawędzi mapy
  s02: { placement: "left" }, // Prawy compwall
  s03: { placement: "left" }, // Lewy compwall
  // s06: { placement: "above", scale: 1.2 },
};
export const COUNTER_OVERRIDES: Record<string, Partial<BadgeStyle>> = {
   // s03: { placement: "right", dx: 1000, dy: 800 }, // przy prawej krawędzi mapy
};

// Znak między sześciokątem a liczbą (zmień na "x", jeśli wolisz)
export const COUNTER_TIMES = "×";
