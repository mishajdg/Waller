/*
 * Iteracja 41 — Sektory jako liniowe krawędzie ścianki (widok z lotu ptaka)
 * =========================================================
 * MAP_SIZE: 3200×1400 (canvas)
 *
 * Koncepcja: Mapa pokazuje GÓRNE KRAWĘDZIE paneli ścianki wspinaczkowej
 * widziane z lotu ptaka. Każdy sektor to ODCINEK ściany między dwoma
 * punktami węzłowymi (czarnymi kropkami). Sektory nie są zamkniętymi
 * prostokątami — to linie z cienkimi hitboxami (polygonami).
 *
 * Struktura wg referencji IMG_8240:
 *   1. Górna belka: Beczka → Lewy dach → Prawy dach (linia biegnąca od lewej do prawej)
 *   2. Prawa kolumna: Lewy compwall → Prawy compwall (linia biegnąca w dół)
 *   3. Dolna prawa: Slab (linia biegnąca w dół-lewo i w lewo)
 *   4. Centralny hexagon: Duży przewis → Średni przewis → Mały przewis → Czujny pion → Logo
 *   5. Spraywall: oddzielny prostokąt z wcięciami (jedyny zamknięty kształt)
 *
 * Węzły (czarne kropki) — punkty graniczne sektorów:
 *   N1(870,260) — stub Beczki góra
 *   N2(870,340) — start Beczki
 *   N3(1250,310) — Beczka/Lewy dach granica
 *   N4(1500,290) — środek Lewego dachu (dot)
 *   N5(1720,280) — Lewy dach/Prawy dach granica
 *   N6(2100,340) — środek Prawego dachu (dot/załamanie)
 *   N7(2400,310) — Prawy dach/Lewy compwall granica
 *   N8(2500,580) — Lewy compwall/Prawy compwall granica
 *   N9(2580,880) — Prawy compwall/Slab granica
 *   N10(2500,1060) — środek Slabu (załamanie)
 *   N11(2100,1120) — koniec Slabu
 *   N12(2000,1180) — stub Slabu dół
 *
 *   Hexagon (6 wierzchołków):
 *   H1(1100,530) — góra-lewo (Duży przewis / Średni przewis)
 *   H2(1400,490) — góra-środek (Średni przewis / Mały przewis)
 *   H3(1680,530) — góra-prawo (Mały przewis / Czujny pion)
 *   H4(1800,720) — prawo (Czujny pion / Logo)
 *   H5(1600,920) — dół-prawo (Logo)
 *   H6(1200,920) — dół-lewo (Logo / Duży przewis)
  * Waller Gym — Mapa boulderów
 * Dane sektorów, segmentów ścian i pinów boulderów
 *
 * Struktura:
 * - sectors: Definicje sektorów (polygon hitbox, etykieta, kolor, metadane)
 * - wallSegments: Czarne kreski — linie ścian podzielone na sektory
 * - boulderPins: Piny boulderów z kolorami trudności i holderów
 *
 * Iteracja 42: Zaktualizowane wallSegments z danymi użytkownika.
 * Polygony dostosowane do ±30 SVG units od segmentów.
 */
import type { BoulderGrade, BoulderPin, GradeColorDefinition, HoldColorKey, Point, Sector, WallSegment } from "../types";

export const MAP_SIZE = {
  width: 8000,
  height: 8000,
};

export const HOLD_COLORS: Record<HoldColorKey, { label: string; hex: string; text: string }> = {
  red:       { label: "Czerwony",      hex: "#df4438", text: "#ffffff" },
  blue:      { label: "Niebieski",     hex: "#2478d4", text: "#ffffff" },
  yellow:    { label: "Żółty",         hex: "#f2c84b", text: "#241a00" },
  green:     { label: "Zielony",       hex: "#19a463", text: "#ffffff" },
  orange:    { label: "Pomarańczowy",  hex: "#f08b22", text: "#221407" },
  purple:    { label: "Fioletowy",     hex: "#7759cf", text: "#ffffff" },
  black:     { label: "Czarny",        hex: "#242424", text: "#ffffff" },
  white:     { label: "Biały",         hex: "#f7f1e4", text: "#27231e" },
  lightBlue: { label: "Błękitny",      hex: "#7fc8f8", text: "#12263a" },
  gray:      { label: "Szary",         hex: "#8d8a84", text: "#ffffff" },
  pink:      { label: "Różowy",        hex: "#e64fa3", text: "#ffffff" },
};

export const GRADE_COLORS: Record<BoulderGrade, GradeColorDefinition> = {
  1:  { label: "1 — biały",        hex: "#f7f1e4", text: "#27231e" },
  2:  { label: "2 — żółty",        hex: "#f2c84b", text: "#241a00" },
  3:  { label: "3 — pomarańczowy", hex: "#f08b22", text: "#221407" },
  4:  { label: "4 — czerwony",     hex: "#df4438", text: "#ffffff" },
  5:  { label: "5 — fioletowy",    hex: "#7759cf", text: "#ffffff" },
  6:  { label: "6 — różowy",       hex: "#e64fa3", text: "#ffffff" },
  7:  { label: "7 — niebieski",    hex: "#2478d4", text: "#ffffff" },
  8:  { label: "8 — zielony",      hex: "#19a463", text: "#ffffff" },
  9:  { label: "9 — brązowy",      hex: "#7b4a28", text: "#ffffff" },
  10: { label: "10 — czarny",      hex: "#242424", text: "#ffffff" },
};


const SCALE = 2.5
const scalePoint = (p: Point): Point => ({x: p.x * SCALE, y: p.y * SCALE,});
const T = 0; // grubość hitboxa (połowa)


export const sectors: Sector[] = [

  // ─── S01: SLAB — dolna prawa (linia: N9→N10→N11→N12) ─────────────────────
  {
    id: "s01",
    code: "1",
    name: "Slab",
    shortName: "Slab",
    polygon: [
     
      scalePoint({ x: 1515, y: 865 }),
      scalePoint({ x: 1485, y: 910 }),
      scalePoint({ x: 1460, y: 940 }),
      scalePoint({ x: 1375, y: 1030 }),
      scalePoint({ x: 1315, y: 1010 }),
      scalePoint({ x: 1320, y: 950 }),
      scalePoint({ x: 1400, y: 910 }),
      scalePoint({ x: 1455, y: 865 }),
    ],
    label: scalePoint({ x: 1480, y: 950 }),
    fill: "#ffffff",
    settingDate: "2026-06-01",
    removalDate: "2026-07-15",
    author: "Routesetter Karma",
    description: "Dolny prawy slab, spokojne wejścia i techniczne linie na nogi.",
  },

  // ─── S02: PRAWY COMPWALL — prawa kolumna dolna (linia: N8→N9) ─────────────
  {
    id: "s02",
    code: "2",
    name: "Prawy compwall",
    shortName: "Prawy comp",
    polygon: [
      
      scalePoint({ x: 1490, y: 675 }),
      scalePoint({ x: 1515, y: 715 }),
      scalePoint({ x: 1515, y: 865 }),
      scalePoint({ x: 1455, y: 865 }),
      scalePoint({ x: 1455, y: 715 }),
      scalePoint({ x: 1430, y: 675 }),
    ],
    label: scalePoint({ x: 1540, y: 780 }),
    fill: "#ffffff",
    settingDate: "2026-06-01",
    removalDate: "2026-07-15",
    author: "Routesetter Karma",
    description: "Prawa część compwalla z liniami kompresyjnymi i dynamicznymi.",
  },

  // ─── S03: LEWY COMPWALL — prawa kolumna górna (linia: N7→N8) ──────────────
  {
    id: "s03",
    code: "3",
    name: "Lewy compwall",
    shortName: "Lewy comp",
    polygon: [
      
      scalePoint({ x: 1465, y: 480 }),
      scalePoint({ x: 1490, y: 565 }),
      scalePoint({ x: 1490, y: 675 }),
      scalePoint({ x: 1430, y: 675 }),
      scalePoint({ x: 1430, y: 565 }),
      scalePoint({ x: 1405, y: 540 }),
    ],
    label: scalePoint({ x: 1510, y: 575 }),
    fill: "#ffffff",
    settingDate: "2026-06-01",
    removalDate: "2026-07-15",
    author: "Routesetter Karma",
    description: "Lewa część compwalla, dobre miejsce na bouldery zawodnicze.",
  },

  // ─── S04: PRAWY DACH — górna prawa belka (linia: N5→N6→N7) ────────────────
  {
    id: "s04",
    code: "4",
    name: "Prawy dach",
    shortName: "Prawy dach",
    polygon: [
      
      scalePoint({ x: 1280, y: 420 }),
      scalePoint({ x: 1465, y: 480 }),
      scalePoint({ x: 1405, y: 540 }),
      scalePoint({ x: 1220, y: 480 }),    ],
    label: scalePoint({ x: 1390, y: 450 }),
    fill: "#ffffff",
    settingDate: "2026-05-20",
    removalDate: "2026-07-01",
    author: "Routesetter Karma",
    description: "Prawy dach — duże przewisy po prawej stronie hali.",
  },

  // ─── S05: LEWY DACH — górna środkowa belka (linia: N3→N4→N5) ──────────────
  {
    id: "s05",
    code: "5",
    name: "Lewy dach",
    shortName: "Lewy dach",
    polygon: [
      
      scalePoint({ x: 1160, y: 280 }),
      scalePoint({ x: 1280, y: 420 }),
      scalePoint({ x: 1220, y: 480 }),
      scalePoint({ x: 1100, y: 340 }),
    ],
    label: scalePoint({ x: 1260, y: 370 }),
    fill: "#ffffff",
    settingDate: "2026-05-20",
    removalDate: "2026-07-01",
    author: "Routesetter Karma",
    description: "Lewy dach nad główną częścią mapy.",
  },

  // ─── S06: BECZKA — górna lewa belka (linia: N1→N2→N3) ─────────────────────
  {
    id: "s06",
    code: "6",
    name: "Beczka",
    shortName: "Beczka",
    polygon: [
      
      scalePoint({ x: 885, y: 220 }),
      scalePoint({ x: 910, y: 240 }),
      scalePoint({ x: 980, y: 270 }),
      scalePoint({ x: 1160, y: 280 }),
      scalePoint({ x: 1100, y: 340 }),
      scalePoint({ x: 920, y: 330 }),
      scalePoint({ x: 850, y: 300 }),
      scalePoint({ x: 825, y: 280 }),
    ],
    label: scalePoint({ x: 1050, y: 290 }),
    fill: "#ffffff",
    settingDate: "2026-05-15",
    removalDate: "2026-06-27",
    author: "Routesetter Karma",
    description: "Beczkowata formacja i obwodowe sekwencje.",
  },

  // ─── S07: LOGO — dolna krawędź hexagonu (linia: H4→H5→H6) ─────────────────
  {
    id: "s07",
    code: "7",
    name: "Logo",
    shortName: "Logo",
    polygon: [
      
      scalePoint({ x: 1110, y: 840 }),
      scalePoint({ x: 960, y: 845 }),
      scalePoint({ x: 955, y: 830 }),
      scalePoint({ x: 895, y: 770 }),
      scalePoint({ x: 900, y: 900 }),
      scalePoint({ x: 1150, y: 900 }),
    ],
    label: scalePoint({ x: 1040, y: 910 }),
    fill: "#ffffff",
    settingDate: "2026-05-08",
    removalDate: "2026-06-20",
    author: "Routesetter Karma",
    description: "Dolna krawędź centralnej bryły, przewis z logo i liniami rozgrzewkowymi.",
  },

  // ─── S08: CZUJNY PION — prawa krawędź hexagonu (linia: H3→H4) ─────────────
  {
    id: "s08",
    code: "8",
    name: "Czujny pion",
    shortName: "Czujny pion",
    polygon: [
    
      scalePoint({ x: 1260, y: 690 }),
      scalePoint({ x: 1110, y: 840 }),
      scalePoint({ x: 1150, y: 900 }), 
    ],
    label: scalePoint({ x: 1270, y: 800 }),
    fill: "#ffffff",
    settingDate: "2026-05-08",
    removalDate: "2026-06-20",
    author: "Routesetter Karma",
    description: "Prawy dolny fragment centralnej bryły; pion i delikatne ustawienia na balans.",
  },

  // ─── S09: MAŁY PRZEWIS — prawa górna krawędź hexagonu (linia: H2→H3) ──────
  {
    id: "s09",
    code: "9",
    name: "Mały przewis",
    shortName: "Mały przewis",
    polygon: [
      // Pasek wokół H2(1400,490)→H3(1680,530)
      scalePoint({ x: 1180, y: 560 }),
      scalePoint({ x: 1260, y: 690 }),
      scalePoint({ x: 1200, y: 750 }),
      scalePoint({ x: 1120, y: 620 }),
    ],
    label: scalePoint({ x: 1290, y: 650 }),
    fill: "#ffffff",
    settingDate: "2026-05-15",
    removalDate: "2026-06-27",
    author: "Routesetter Karma",
    description: "Kompromis siły i techniki. Mały przewis - szeroki wachlarz ruchów. ",
  },

  // ─── S10: ŚREDNI PRZEWIS — górna krawędź hexagonu (linia: H1→H2) ──────────
  {
    id: "s10",
    code: "10",
    name: "Średni przewis",
    shortName: "Średni przewis",
    polygon: [
      // Pasek wokół H1(1100,530)→H2(1400,490)
      scalePoint({ x: 950, y: 600 }),
      scalePoint({ x: 1180, y: 560 }),
      scalePoint({ x: 1120, y: 620 }),
      scalePoint({ x: 1000, y: 660 }),
    ],
    label: scalePoint({ x: 1040, y: 580 }),
    fill: "#fff4fff",
    settingDate: "2026-05-15",
    removalDate: "2026-06-27",
    author: "Routesetter Karma",
    description: "40-sto stopniowa płyta zwężająca się ku dołowi",
  },

  // ─── S11: DUŻY PRZEWIS — lewa krawędź hexagonu (linia: H6→H1) ─────────────
  {
    id: "s11",
    code: "11",
    name: "Duży przewis",
    shortName: "Duży przewis",
    polygon: [
      // Pasek wokół H6(1200,920)→H1(1100,530)
      scalePoint({ x: 900, y: 685 }),
      scalePoint({ x: 950, y: 600 }),
      scalePoint({ x: 1000, y: 660 }),
      scalePoint({ x: 955, y: 830 }),
      scalePoint({ x: 895, y: 770 }),
      scalePoint({ x: 890, y: 745 }),
    ],
    label: scalePoint({ x: 820, y: 730 }),
    fill: "#ffffff",
    settingDate: "2026-05-08",
    removalDate: "2026-06-20",
    author: "Routesetter Karma",
    description: "50 stopni wyzwania dla bicepsów",
  },

  // ─── S12: SPRAYWALL — lewa pionowa ściana (zamknięty prostokąt z wcięciami) ─
  {
    id: "s12",
    code: "12",
    name: "Spraywall",
    shortName: "Spray",
    polygon: [
      scalePoint({ x: 560,  y: 440 }),
      scalePoint({ x: 760,  y: 440 }),
      scalePoint({ x: 760,  y: 590 }),
      scalePoint({ x: 700,  y: 590 }),
      scalePoint({ x: 700,  y: 1000 }),
      scalePoint({ x: 760,  y: 1000 }),
      scalePoint({ x: 760,  y: 1180 }),
      scalePoint({ x: 560,  y: 1180 }),
    ],
    label: scalePoint({ x: 660, y: 790 }),
    fill: "#ffffff",
    settingDate: "2026-06-01",
    removalDate: "2026-08-01",
    author: "Routesetter Karma",
    description: "Wszechstronne narzędzie do osiągania Twoich celów wspinaczkowych",
  },
];


// Wall segments — linie ścian (czarne kreski z referencji).

export const wallSegments: WallSegment[] = [
  
  // Beczka:
  { id: "seg-s06-main",  sectorId: "s06", name: "Beczka V",          start: scalePoint({ x: 855,  y: 250 }),  end: scalePoint({ x: 880, y: 270 }),   angleLabel: "beczka" },
  { id: "seg-s06-slab",  sectorId: "s06", name: "Beczka slab",       start: scalePoint({ x: 880,  y: 270 }),  end: scalePoint({ x: 950, y: 300 }),   angleLabel: "beczka" },
  { id: "seg-s06-slab",  sectorId: "s06", name: "Beczka main",       start: scalePoint({ x: 950,  y: 300 }),  end: scalePoint({ x: 1178, y: 310 }),  angleLabel: "beczka" },
  
  // Lewy dach:
  { id: "seg-s05-1",     sectorId: "s05", name: "Lewy dach — L",     start: scalePoint({ x: 1130, y: 310 }),  end: scalePoint({ x: 1250, y: 450 }),  angleLabel: "dach" },

  // Prawy dach:
  { id: "seg-s04-1",     sectorId: "s04", name: "Prawy dach — L",    start: scalePoint({ x: 1250, y: 450 }),  end: scalePoint({ x: 1435, y: 510 }),  angleLabel: "dach" },

  // Lewy compwall:
  { id: "seg-s03-V",     sectorId: "s03", name: "Lewy comp V1",      start: scalePoint({ x: 1435, y: 510 }),  end: scalePoint({ x: 1460, y: 595 }),  angleLabel: "compwall" },
  { id: "seg-s03-main",  sectorId: "s03", name: "Lewy comp main",    start: scalePoint({ x: 1460, y: 595 }),  end: scalePoint({ x: 1460, y: 675 }),  angleLabel: "compwall" },

  // Prawy compwall:
  { id: "seg-s02-V",    sectorId: "s02", name: "Prawy comp V",       start: scalePoint({ x: 1460, y: 675 }),  end: scalePoint({ x: 1485, y: 745 }),  angleLabel: "compwall" },
  { id: "seg-s02-main", sectorId: "s02", name: "Prawy comp main",    start: scalePoint({ x: 1485, y: 745 }),  end: scalePoint({ x: 1485, y: 865 }),  angleLabel: "compwall" },

  // Slab: 
  { id: "seg-s01-1",     sectorId: "s01", name: "Slab — lewy",       start: scalePoint({ x: 1485, y: 865 }), end: scalePoint({ x: 1430, y: 940 }),   angleLabel: "slab" },
  { id: "seg-s01-2",     sectorId: "s01", name: "Slab — prawy",      start: scalePoint({ x: 1430, y: 940 }), end: scalePoint({ x: 1350, y: 980 }),   angleLabel: "slab" },
  { id: "seg-s01-3",     sectorId: "s01", name: "Slab — prawe V",    start: scalePoint({ x: 1350, y: 980 }), end: scalePoint({ x: 1345, y: 1000 }),   angleLabel: "slab" },

  // ═══ GRZYB ═══
  // Średni przewis: 
  { id: "seg-hex-s10",   sectorId: "s10", name: "Średni przewis",    start: scalePoint({ x: 970, y: 630 }),  end: scalePoint({ x: 1150, y: 590 }),  angleLabel: "hex" },
  // Mały przewis:
  { id: "seg-hex-s09",   sectorId: "s09", name: "Mały przewis main",      start: scalePoint({ x: 1150, y: 590 }), end: scalePoint({ x: 1230, y: 720 }),  angleLabel: "hex" },
  // Czujny pion:
  { id: "seg-hex-s08",   sectorId: "s08", name: "Czujny pion",       start: scalePoint({ x: 1230, y: 720 }), end: scalePoint({ x: 1130, y: 870 }),  angleLabel: "hex" },
  // Logo:
  { id: "seg-hex-s07b",  sectorId: "s07", name: "Logo — front",      start: scalePoint({ x: 1130, y: 870 }), end: scalePoint({ x: 930, y: 875}),   angleLabel: "hex" },
  { id: "seg-hex-s07a",  sectorId: "s07", name: "Logo — przewis",    start: scalePoint({ x: 930, y: 875}),   end: scalePoint({ x: 925, y: 800}),   angleLabel: "hex" },
  // Duży przewis:
  { id: "seg-hex-s11",   sectorId: "s11", name: "Duży przewis",      start: scalePoint({ x: 920, y: 715 }),  end: scalePoint({ x: 970, y: 630 }),   angleLabel: "hex" },
  { id: "seg-hex-s11.1", sectorId: "s11", name: "Duży przewis V",    start: scalePoint({ x: 920, y: 715 }),  end: scalePoint({ x: 925, y: 800 }),   angleLabel: "hex" },
  
  // ═══ SPRAYWALL ═══
  { id: "seg-s12-top",    sectorId: "s12", name: "Prawy pionik",     start: scalePoint({ x: 560,  y: 440 }),  end: scalePoint({ x: 660,  y: 440  }), angleLabel: "spraywall" },
  { id: "seg-s12-right",  sectorId: "s12", name: "Prawy przewisik",  start: scalePoint({ x: 560,  y: 590 }),  end: scalePoint({ x: 560,  y: 440  }), angleLabel: "spraywall" },
  { id: "seg-s12-notch1", sectorId: "s12", name: "Prawe wcięcie",    start: scalePoint({ x: 600,  y: 600 }),  end: scalePoint({ x: 560,  y: 590  }), angleLabel: "spraywall" },
  { id: "seg-s12-mid",    sectorId: "s12", name: "Środek przewis",   start: scalePoint({ x: 600,  y: 600 }),  end: scalePoint({ x: 600,  y: 990  }), angleLabel: "spraywall" },
  { id: "seg-s12-notch2", sectorId: "s12", name: "Lewe wcięcie",     start: scalePoint({ x: 600,  y: 990 }),  end: scalePoint({ x: 560,  y: 1000 }), angleLabel: "spraywall" },
  { id: "seg-s12-left",   sectorId: "s12", name: "Lewy przewisik",   start: scalePoint({ x: 560,  y: 1180 }), end: scalePoint({ x: 560,  y: 1000 }), angleLabel: "spraywall" },
  { id: "seg-s12-bot",    sectorId: "s12", name: "Lewy pionik",      start: scalePoint({ x: 660,  y: 1180 }), end: scalePoint({ x: 560,  y: 1180 }), angleLabel: "spraywall" },

  // --- Strefa: Dach (Lewy dach / Prawy dach / górna część compwalli) ---
   { id: "seg-roof-new-1", sectorId: "s05", name: "lewy dach górne środkowe przełamanie", start: scalePoint({ x: 1178, y: 310 }), end: scalePoint({ x: 1252, y: 445 }), angleLabel: "dach" },
   { id: "seg-roof-new-6", sectorId: "s05", name: "lewy dach dolne środkowe przełamanie", start: scalePoint({ x: 1313, y: 258 }), end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   { id: "seg-roof-r2-2",  sectorId: "s05", name: "prawy/lewy dach środek dół.",          start: scalePoint({ x: 1354, y: 336 }), end: scalePoint({ x: 1254, y: 447 }), angleLabel: "dach" }, // frag=4
   { id: "seg-roof-new-2", sectorId: "s05", name: "prawy/lewy dach środek góra",          start: scalePoint({ x: 1397, y: 282 }), end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   { id: "seg-roof-new-6", sectorId: "s05", name: "lewy dach górne boczne przełamanie",   start: scalePoint({ x: 1178, y: 310 }), end: scalePoint({ x: 1313, y: 258 }), angleLabel: "dach" },
   { id: "seg-roof-new-3", sectorId: "s05", name: "beczka/lewy dach dół",                 start: scalePoint({ x: 1060, y: 260 }), end: scalePoint({ x: 1178, y: 310 }), angleLabel: "dach" },
   { id: "seg-roof-r2-8", sectorId: "s05", name: "lewy dach dolne boczne przełamanie",    start: scalePoint({ x: 1347, y: 221 }), end: scalePoint({ x: 1315, y: 258 }), angleLabel: "dach" },
   { id: "seg-roof-r2-8", sectorId: "s05", name: "lewy dach podstawa styczna z beczką",   start: scalePoint({ x: 1347, y: 221 }), end: scalePoint({ x: 1060, y: 260 }), angleLabel: "dach" },
   { id: "seg-s06-slab",  sectorId: "s05", name: "Beczka main fragment przy lewym dachu", start: scalePoint({ x: 1130, y: 310 }),  end: scalePoint({ x: 1178, y: 310 }),  angleLabel: "beczka" },
  

   { id: "seg-roof-new-4", sectorId: "s04", name: "prawy dach dolne środkowe przełamanie",start: scalePoint({ x: 1354, y: 336 }), end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   { id: "seg-roof-new-5", sectorId: "s04", name: "prawy dach podstawa",                  start: scalePoint({ x: 1397, y: 282 }), end: scalePoint({ x: 1503, y: 336 }), angleLabel: "dach" },
   { id: "seg-roof-r2-2",  sectorId: "s04", name: "prawy/lewy dach środek dół.",          start: scalePoint({ x: 1354, y: 336 }), end: scalePoint({ x: 1254, y: 447 }), angleLabel: "dach" }, // frag=4
   { id: "seg-roof-new-2", sectorId: "s04", name: "prawy/lewy dach środek góra",          start: scalePoint({ x: 1397, y: 282 }), end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   { id: "seg-roof-new-2", sectorId: "s04", name: "prawy dach środek bok",                start: scalePoint({ x: 1503, y: 336 }), end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   { id: "seg-roof-new-2", sectorId: "s04", name: "prawy dach środek góra",               start: scalePoint({ x: 1435, y: 510 }), end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   { id: "seg-roof-new-6", sectorId: "s04", name: "prawy dach pdst. styczna z lewy comp", start: scalePoint({ x: 1503, y: 336 }), end: scalePoint({ x: 1480, y: 540 }), angleLabel: "dach" },
   { id: "seg-s03-corner", sectorId: "s04", name: "kant lewy compwall/prawy dach",        start: scalePoint({ x: 1435, y: 510 }), end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" }, 
  

  // --- Strefa: Hexagon "grzyb" (Średni/Mały przewis, Czujny pion, Logo, Duży przewis) ---
  { id: "seg-hex-new-1", sectorId: "s11", name: "pdst. duży przewis",                          start: scalePoint({ x: 981, y: 668 }), end: scalePoint({ x: 960, y: 805 }), angleLabel: "hex" },
  { id: "seg-hex-new-1", sectorId: "s11", name: "kant dużego przewisu z lewym przewisem loga", start: scalePoint({ x: 920, y: 715 }), end: scalePoint({ x: 960, y: 805 }), angleLabel: "hex" },
  { id: "seg-hex-new-3", sectorId: "s11", name: "duży przewis pdst.",                          start: scalePoint({ x: 1111, y: 726 }), end: scalePoint({ x: 1040, y: 823 }), angleLabel: "hex" },
  { id: "seg-hex-new-4", sectorId: "s11", name: "dolny kant dużego i średniego przewisu",      start: scalePoint({ x: 981, y: 668 }), end: scalePoint({ x: 1111, y: 726 }), angleLabel: "hex" },
  { id: "seg-hex-new-1.1",sectorId: "s11", name: "górny kant dużego i średniego przewisu",     start: scalePoint({ x: 970, y: 630 }), end: scalePoint({ x: 981, y: 668 }), angleLabel: "hex" },
  { id: "seg-hex-new-6", sectorId: "s11", name: "dolny kant dużego i lewego przewisu logo",    start: scalePoint({ x: 960, y: 805 }), end: scalePoint({ x: 1040, y: 823 }), angleLabel: "hex" },
  { id: "seg-hex-new-6", sectorId: "s11", name: "górny kant dużego i lewego przewisu logo",    start: scalePoint({ x: 960, y: 805 }), end: scalePoint({ x: 925, y: 800 }), angleLabel: "hex" },
  
  { id: "seg-hex-new-1.1",sectorId: "s10", name: "górny kant dużego i średniego przewisu",     start: scalePoint({ x: 970, y: 630 }), end: scalePoint({ x: 981, y: 668 }), angleLabel: "hex" },
  { id: "seg-hex-new-4",  sectorId: "s10", name: "dolny kant dużego i średniego przewisu",     start: scalePoint({ x: 981, y: 668 }), end: scalePoint({ x: 1111, y: 726 }), angleLabel: "hex" },
  { id: "seg-hex-new-5.2", sectorId: "s10", name: "średni przewis pdst.",                      start: scalePoint({ x: 1111, y: 726 }), end: scalePoint({ x: 1133, y: 722 }), angleLabel: "hex" },
  { id: "seg-hex-new-5",   sectorId: "s10", name: "kant średniego i małego przewisu",          start: scalePoint({ x: 1150, y: 590 }), end: scalePoint({ x: 1133, y: 722 }), angleLabel: "hex" },

  { id: "seg-hex-new-5",   sectorId: "s09", name: "kant średniego i małego przewisu",          start: scalePoint({ x: 1150, y: 590 }), end: scalePoint({ x: 1133, y: 722 }), angleLabel: "hex" },
  { id: "seg-hex-new-5.1", sectorId: "s09", name: "mały przewis pdst.",                        start: scalePoint({ x: 1133, y: 722 }), end: scalePoint({ x: 1180, y: 790 }), angleLabel: "hex" },
  { id: "seg-hex-s08",     sectorId: "s09", name: "kant czujnego pionu i małego przewisu",     start: scalePoint({ x: 1230, y: 720 }), end: scalePoint({ x: 1180, y: 790 }),  angleLabel: "hex" },
  
  { id: "seg-hex-new-1", sectorId: "s07", name: "kant lewego przewisu z logiem",               start: scalePoint({ x: 930, y: 875 }), end: scalePoint({ x: 960, y: 805 }), angleLabel: "hex" },
  { id: "seg-hex-new-6", sectorId: "s07", name: "dolny kant dużego i lewego przewisu logo",    start: scalePoint({ x: 960, y: 805 }), end: scalePoint({ x: 1040, y: 823 }), angleLabel: "hex" },
  { id: "seg-hex-new-7", sectorId: "s07", name: "lewy przewis logo pdst.",                     start: scalePoint({ x: 1060, y: 871 }), end: scalePoint({ x: 1040, y: 823 }), angleLabel: "hex" },
  { id: "seg-hex-new-6", sectorId: "s07", name: "górny kant dużego i lewego przewisu logo",    start: scalePoint({ x: 960, y: 805 }), end: scalePoint({ x: 925, y: 800 }), angleLabel: "hex" },
  
  // --- Compwall ---
  { id: "seg-s03-corner", sectorId: "s03", name: "kant lewe V/prawy compwall ",                start: scalePoint({ x: 1480, y: 540 }), end: scalePoint({ x: 1460, y: 595 }), angleLabel: "compwall" },  
  { id: "seg-s03-corner", sectorId: "s03", name: "kant lewy compwall/prawy dach",              start: scalePoint({ x: 1435, y: 510 }), end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" }, 
  { id: "seg-s02-corner", sectorId: "s03", name: "kant prawe V/lewy compwall",                 start: scalePoint({ x: 1460, y: 675 }), end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 

  { id: "seg-s02-corner", sectorId: "s02", name: "kant prawy compwall/slab",                   start: scalePoint({ x: 1505, y: 835 }), end: scalePoint({ x: 1485, y: 865 }), angleLabel: "compwall" }, 
  { id: "seg-s02-corner", sectorId: "s02", name: "kant prawe V/prawy compwall",                start: scalePoint({ x: 1485, y: 745 }), end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 
  { id: "seg-s02-corner", sectorId: "s02", name: "kant prawe V/lewy compwall",                 start: scalePoint({ x: 1460, y: 675 }), end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 
  
    // Slab:
   { id: "seg-s01-diag", sectorId: "s01", name: "Slab — podstawa V", start: scalePoint({ x: 1338, y: 999 }), end: scalePoint({ x: 1345, y: 970 }), angleLabel: "slab" },
   { id: "seg-s01-diag2", sectorId: "s01", name: "Slab — podstawa prawa", start: scalePoint({ x: 1440, y: 925 }), end: scalePoint({ x: 1345, y: 970 }), angleLabel: "slab" },
   { id: "seg-s01-diag2", sectorId: "s01", name: "Slab — podstawa prawa", start: scalePoint({ x: 1340, y: 1000 }), end: scalePoint({ x: 1344, y: 1000 }), angleLabel: "slab" },

   // --- Dach (najwyższa pewność, frag 3-4) ---
  
   // --- Beczka ---
   
   { id: "seg-s06-diag2", sectorId: "s06", name: "beczka kant V", start: scalePoint({ x: 880, y: 270 }), end: scalePoint({ x: 880, y: 250 }), angleLabel: "beczka" },
   { id: "seg-roof-new-3", sectorId: "s06", name: "beczka/lewy dach dół", start: scalePoint({ x: 1060, y: 260 }), end: scalePoint({ x: 1178, y: 310 }), angleLabel: "dach" },

   //         ---------------------------- SEGREGACJA SEGMENTÓW ----------------------------
   { id: "seg-roof-r2-1", sectorId: "s06", name: "beczka pdst.", start: scalePoint({ x: 949, y: 280 }), end: scalePoint({ x: 1060, y: 260 }), angleLabel: "dach" },
   { id: "seg-beczka-r2-1", sectorId: "s06", name: "Beczka pdst. slab", start: scalePoint({ x: 880, y: 250 }), end: scalePoint({ x: 990, y: 300 }), angleLabel: "beczka" },
   { id: "seg-s06-diag", sectorId: "s06", name: "beczka pdst. V", start: scalePoint({ x: 855, y: 250 }), end: scalePoint({ x: 880, y: 250 }), angleLabel: "beczka" },
   { id: "seg-roof-r2-4", sectorId: "s05", name: "lewy dach pdst.", start: scalePoint({ x: 1347, y: 221 }), end: scalePoint({ x: 1396, y: 281}), angleLabel: "dach" }, 
   { id: "seg-s03-diag", sectorId: "s03", name: "Lewy compwall pdst.", start: scalePoint({ x: 1500, y: 710 }), end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" },
   { id: "seg-s02-diag", sectorId: "s02", name: "Prawy compwall pdst.", start: scalePoint({ x: 1500, y: 710 }), end: scalePoint({ x: 1505, y: 835 }), angleLabel: "compwall" },
 
];

/**
 * Linie materaca (mat lines) — szare linie okalające sektory.
 */
export const matLines: Array<{ id: string; start: Point; end: Point; dashed?: boolean}> = [
  
  { id: "mat-00", start: { x: 785, y: 250 },  end: { x: 850, y: 250 } },
  { id: "mat-01", start: { x: 785, y: 250 },  end: { x: 784, y: 333 } },   
  { id: "mat-02", start: { x: 784, y: 333 },  end: { x: 848, y: 372 } },
  { id: "mat-03", start: { x: 848, y: 372 },  end: { x: 908, y: 390 } },
  { id: "mat-04", start: { x: 908, y: 390 },  end: { x: 1066, y: 386 }},
  { id: "mat-05", start: { x: 1066, y: 386 }, end: { x: 1044, y: 523 }},  
  { id: "mat-06", start: { x: 1044, y: 523 }, end: { x: 911, y: 560 } },
  { id: "mat-07", start: { x: 911, y: 560 },  end: { x: 826, y: 733 } },   
  { id: "mat-08", start: { x: 826, y: 733 },  end: { x: 828, y: 931 } },
  { id: "mat-09", start: { x: 828, y: 931 },  end: { x: 869, y: 994 } },
  { id: "mat-10", start: { x: 869, y: 994 },  end: { x: 1165, y: 964 }},
  { id: "mat-11", start: { x: 1165, y: 964 }, end: { x: 1329, y: 735 }},
  { id: "mat-12", start: { x: 1329, y: 735 }, end: { x: 1385, y: 772 }},
  { id: "mat-13", start: { x: 1385, y: 772 }, end: { x: 1296, y: 904 }},  
  { id: "mat-14", start: { x: 1296, y: 904 }, end: { x: 1296, y: 1000 }},
  { id: "mat-15", start: { x: 1296, y: 1000 }, end:{ x: 1345, y: 1000 }},

  //{ id: "seg-s12-top",    start: { x: 560,  y: 340 },  end: { x: 660,  y: 900 }, dashed: true },
 // ═══ DODATKOWE ŻEBRA/FASETKI (na podstawie zacienionego renderu architekta) ═══
// Końce linii oznaczone punktami 1–20 są DOKŁADNE (z istniejącego kodu).
// Nowe punkty wewnętrzne (grzbiet dachu, centroid hexagonu) są SZACOWANE
// jako środek geometryczny sąsiednich punktów — do ręcznej korekty.

  // --- Grzbiet dachu (Lewy dach / Prawy dach), punkt wewnętrzny ~(1272, 423) ---
  // { id: "seg-s05-ridge", sectorId: "s05", name: "Lewy dach — żebro do grzbietu", start: scalePoint({ x: 1130, y: 310 }), end: scalePoint({ x: 1272, y: 423 }), angleLabel: "dach" }, // pkt. 4 → grzbiet
  // { id: "seg-s04-ridge", sectorId: "s04", name: "Prawy dach — żebro do grzbietu", start: scalePoint({ x: 1435, y: 510 }), end: scalePoint({ x: 1272, y: 423 }), angleLabel: "dach" }, // pkt. 6 → grzbiet
  // { id: "seg-s04-ridge-2", sectorId: "s04", name: "Grzbiet — do pkt. 5", start: scalePoint({ x: 1250, y: 450 }), end: scalePoint({ x: 1272, y: 423 }), angleLabel: "dach" }, // pkt. 5 → grzbiet

  // --- Hexagon "grzyb" — 6 żeber do centroidu ~(1056, 748) ---
  // { id: "seg-s10-spoke", sectorId: "s10", name: "Średni przewis — żebro do centrum", start: scalePoint({ x: 970, y: 630 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 14
  // { id: "seg-s09-spoke", sectorId: "s09", name: "Mały przewis — żebro do centrum", start: scalePoint({ x: 1150, y: 590 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 15
  // { id: "seg-s08-spoke", sectorId: "s08", name: "Czujny pion — żebro do centrum", start: scalePoint({ x: 1230, y: 720 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 16
  // { id: "seg-s07-spoke-1", sectorId: "s07", name: "Logo — żebro do centrum (pkt.17)", start: scalePoint({ x: 1130, y: 870 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 17
  // { id: "seg-s07-spoke-2", sectorId: "s07", name: "Logo — żebro do centrum (pkt.18)", start: scalePoint({ x: 930, y: 875 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 18
  // { id: "seg-s11-spoke", sectorId: "s11", name: "Duży przewis — żebro do centrum", start: scalePoint({ x: 925, y: 800 }), end: scalePoint({ x: 1056, y: 748 }), angleLabel: "hex" }, // pkt. 19

  //--- Compwall ---
  //{ id: "seg-s03-corner", sectorId: "s03", name: "Lewy compwall — docięcie narożne", start: scalePoint({ x: 1435, y: 510 }), end: scalePoint({ x: 1460, y: 595 }), angleLabel: "compwall" }, // pkt. 6 → pkt. 7 (offset ~30px w bok, doreguluj wizualnie)
  //{ id: "seg-s02-corner", sectorId: "s02", name: "Prawy compwall — docięcie narożne", start: scalePoint({ x: 1485, y: 745 }), end: scalePoint({ x: 1485, y: 865 }), angleLabel: "compwall" }, // pkt. 9 → pkt. 10 (jw.)
];

/**
 * Przykładowe bouldery — fallback gdy Supabase nie odpowiada.
 * Pozycje dostosowane do nowej geometrii liniowej.
 */
export const boulderPins: BoulderPin[] = [
  // Slab (s01) — piny wzdłuż linii N9→N10→N11
  //{ id: "b01", name: "Cicha stopa",    sectorId: "s01", segmentId: "seg-s01-2",  position: { x: 2350, y: 1080 }, grade: 2, holdColor: "green",  author: "Ania" },
  //{ id: "b02", name: "Slab direct",    sectorId: "s01", segmentId: "seg-s01-1",  position: { x: 2540, y: 970 },  grade: 4, holdColor: "blue",   author: "Michał" },
  // Prawy compwall (s02) — piny wzdłuż N8→N9
  //{ id: "b03", name: "Prawy sprint",   sectorId: "s02", segmentId: "seg-s02-main", position: { x: 2530, y: 680 }, grade: 5, holdColor: "orange", author: "Routesetter Karma" },
  //{ id: "b04", name: "Kompresja",      sectorId: "s02", segmentId: "seg-s02-main", position: { x: 2560, y: 800 }, grade: 8, holdColor: "black",  author: "Kuba" },
  // Lewy compwall (s03) — piny wzdłuż N7→N8
  //{ id: "b05", name: "Środek flow",    sectorId: "s03", segmentId: "seg-s03-main", position: { x: 2440, y: 400 }, grade: 4, holdColor: "red",    author: "Ania" },
  //{ id: "b06", name: "Volume run",     sectorId: "s03", segmentId: "seg-s03-main", position: { x: 2470, y: 500 }, grade: 6, holdColor: "purple", author: "Michał" },
  // Prawy dach (s04) — piny wzdłuż N5→N6→N7
  //{ id: "b07", name: "Prawy dach L",   sectorId: "s04", segmentId: "seg-s04-1",  position: { x: 1900, y: 310 },  grade: 7, holdColor: "black",  author: "Michał" },
  //{ id: "b08", name: "Dach flash",     sectorId: "s04", segmentId: "seg-s04-2",  position: { x: 2250, y: 330 },  grade: 8, holdColor: "red",    author: "Routesetter Karma" },
  //{ id: "b09", name: "Krawędź",        sectorId: "s04", segmentId: "seg-s04-1",  position: { x: 2050, y: 330 },  grade: 5, holdColor: "yellow", author: "Ania" },
  // Lewy dach (s05) — piny wzdłuż N3→N4→N5
  //{ id: "b10", name: "Lewy dach",      sectorId: "s05", segmentId: "seg-s05-1",  position: { x: 1370, y: 300 },  grade: 5, holdColor: "blue",   author: "Kuba" },
  //{ id: "b11", name: "Przelot",        sectorId: "s05", segmentId: "seg-s05-2",  position: { x: 1610, y: 285 },  grade: 8, holdColor: "orange", author: "Michał" },
  // Beczka (s06) — piny wzdłuż N1→N2→N3
  //{ id: "b12", name: "Beczka lewa",    sectorId: "s06", segmentId: "seg-s06-main", position: { x: 970, y: 330 },  grade: 3, holdColor: "green",  author: "Ania" },
  //{ id: "b13", name: "Beczka prawa",   sectorId: "s06", segmentId: "seg-s06-main", position: { x: 1130, y: 320 }, grade: 4, holdColor: "white",  author: "Kuba" },
  // Logo (s07) — piny wzdłuż H4→H5→H6
  //{ id: "b14", name: "Logo rozgrzewka", sectorId: "s07", segmentId: "seg-hex-s07a", position: { x: 1700, y: 820 }, grade: 1, holdColor: "green",  author: "Routesetter Karma" },
  //{ id: "b15", name: "Logo lewy",       sectorId: "s07", segmentId: "seg-hex-s07b", position: { x: 1400, y: 920 }, grade: 4, holdColor: "yellow", author: "Ania" },
  // Czujny pion (s08) — piny wzdłuż H3→H4
 // { id: "b16", name: "Czujny balans",  sectorId: "s08", segmentId: "seg-hex-s08", position: { x: 1740, y: 630 }, grade: 2, holdColor: "white",  author: "Michał" },
  //{ id: "b17", name: "Pion na tarcie", sectorId: "s08", segmentId: "seg-hex-s08", position: { x: 1720, y: 580 }, grade: 4, holdColor: "blue",   author: "Kuba" },
  // Mały przewis (s09) — piny wzdłuż H2→H3
  //{ id: "b18", name: "Mały przewis",    sectorId: "s09", segmentId: "seg-hex-s09", position: { x: 1540, y: 510 }, grade: 6, holdColor: "red",    author: "Ania" },
  //{ id: "b19", name: "Krótkie spięcie", sectorId: "s09", segmentId: "seg-hex-s09", position: { x: 1600, y: 520 }, grade: 8, holdColor: "black",  author: "Michał" },
  // Średni przewis (s10) — piny wzdłuż H1→H2
  //{ id: "b20", name: "Średni L",        sectorId: "s10", segmentId: "seg-hex-s10", position: { x: 1200, y: 520 }, grade: 4, holdColor: "orange", author: "Kuba" },
  //{ id: "b21", name: "Średni P",        sectorId: "s10", segmentId: "seg-hex-s10", position: { x: 1300, y: 505 }, grade: 5, holdColor: "purple", author: "Routesetter Karma" },
  // Duży przewis (s11) — piny wzdłuż H6→H1
  //{ id: "b22", name: "Duży dół",        sectorId: "s11", segmentId: "seg-hex-s11", position: { x: 1170, y: 800 }, grade: 6, holdColor: "purple", author: "Ania" },
  //{ id: "b23", name: "Duży góra",       sectorId: "s11", segmentId: "seg-hex-s11", position: { x: 1130, y: 630 }, grade: 9, holdColor: "black",  author: "Michał" },
  // Spraywall (s12) — piny wewnątrz prostokąta
  //{ id: "b24", name: "Spray easy",      sectorId: "s12", segmentId: "seg-s12-mid", position: { x: 640, y: 600 },  grade: 3, holdColor: "green",  author: "Ania" },
  //{ id: "b25", name: "Spray power",     sectorId: "s12", segmentId: "seg-s12-mid", position: { x: 640, y: 820 },  grade: 7, holdColor: "pink",   author: "Kuba" },
];

export const getSectorById = (id: string) => sectors.find((sector) => sector.id === id);
export const getSegmentById = (id: string) => wallSegments.find((segment) => segment.id === id);
export const getHoldColor = (key: HoldColorKey) => HOLD_COLORS[key];
export const getGradeColor = (grade: BoulderGrade) => GRADE_COLORS[grade];
