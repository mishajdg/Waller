/**
 * Pigułki „nowe" / „stare" oraz licznik ⬡ × N przy nazwie sektora — USTAWIENIA.
 * Odległości są w „em": 1 em = rozmiar czcionki nazwy sektora, więc wszystko skaluje się razem z mapą.
 * Geometrię liczy components/SectorLabel.tsx — tutaj zmieniasz tylko liczby.
 */
export type BadgePlacement = "below" | "above" | "left" | "right" | "down" | "up"; // "down" = "below", "up" = "above"

export type BadgeStyle = {
  placement: BadgePlacement; // gdzie względem nazwy sektora: pod / nad / z lewej / z prawej
  scale: number;             // rozmiar: 1 = domyślny, 1.25 = o 25% większy, 0.8 = mniejszy
  gap: number;               // odstęp od nazwy (em)
  dx: number;                // dosunięcie w prawo (em); wartość ujemna = w lewo
  dy: number;                // dosunięcie w dół (em); wartość ujemna = w górę
  x?: number;                // POŁOŻENIE BEZWZGLĘDNE: środek na mapie, w jednostkach mapy (jak `label` sektora); nadpisuje placement
  y?: number;                // jw. w pionie; można podać samo x albo samo y
};


// Teksty pigułek i ich szerokość w em (przy scale = 1). Dłuższy tekst = większa szerokość.
export const SECTOR_PILLS = {
  new: { text: "nowe", width: 3.2 },
  removal: { text: "stare", width: 3.6 },
} as const;

// Ustawienia domyślne — dla wszystkich sektorów
export const PILL_DEFAULT: BadgeStyle = { placement: "right", scale: 0.85, gap: 0.5, dx: 0, dy: 0 };
export const COUNTER_DEFAULT: BadgeStyle = { placement: "below", scale: 1.4, gap: 0.15, dx: 0, dy: 0 };

// Wyjątki dla pojedynczych sektorów. Klucz = KOD sektora w cudzysłowie ("1", "2", … "12" — ten sam co w panelu
// „SEKTOR 3"); działa też nazwa ("Lewy compwall") i pełne id (UUID). Wartość = tylko to, co zmieniasz.
// Uwaga: id typu "s01" istnieje tylko w danych lokalnych — w Supabase id to UUID, dlatego używaj kodu.
export const PILL_OVERRIDES: Record<string, Partial<BadgeStyle>> = {
  "1": { placement: "right" }, // Slab
  "2": { placement: "left" },  // Prawy compwall
  "3": { placement: "left" },  // Lewy compwall
  // "6": { placement: "above", scale: 1.2 },
};
export const COUNTER_OVERRIDES: Record<string, Partial<BadgeStyle>> = {
  // "3": { x: 1200, y: 500, scale: 1.2 }, // przykład: licznik w punkcie (1200, 500); własne X/Y odczytaj w trybie ?debug=1
  // "10": { placement: "right", dx: 0.5 },
};


// Znak między sześciokątem a liczbą (zmień na "x", jeśli wolisz)
export const COUNTER_TIMES = "×";
