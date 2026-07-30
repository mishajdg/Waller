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

    polygons: [
      
      {
        // Polygon Hitbox Slab
        
        depth: 100,
        points: [
          scalePoint({ x: 1343, y: 962 }), // 28
          scalePoint({ x: 1350, y: 950 }), // 27
          scalePoint({ x: 1338, y: 1030 }), // 26
          scalePoint({ x: 1485, y: 895 }), // 24
        
          scalePoint({ x: 1485, y: 835 }), // 24'
           
          scalePoint({ x: 1338, y: 970 }), // 26'
        
          scalePoint({ x: 1350, y: 1010 }), // 27,
          scalePoint({ x: 1343, y: 1022 }), // 28'
          

          ],
      },
      
    ],

    label: scalePoint({ x: 1415, y: 937 }),

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

    polygons: [
      {
 //Polygon 13
  depth: 3,
  points:[
   scalePoint({ x: 1460, y: 675 }),
   scalePoint({ x: 1500, y: 710 }),
   scalePoint({ x: 1485, y: 745 }),     
  ],
},
{
 //Polygon 14
  depth: 3,
  points:[
   scalePoint({ x: 1485, y: 745 }),    
   scalePoint({ x: 1500, y: 710 }),
   scalePoint({ x: 1505, y: 835 }), 
   scalePoint({ x: 1484.5, y: 866.5 }),
  ],
},
    ],

    label: scalePoint({ x: 1440, y: 748.5 }),

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

    polygons: [
{
 //Polygon 11
  depth: 3,
  points:[
   scalePoint({ x: 1435, y: 510 }),
   scalePoint({ x: 1480, y: 540 }),
   scalePoint({ x: 1460, y: 595 }),     
  ],
},
{
 //Polygon 12
  depth: 3,
  points:[
   scalePoint({ x: 1480, y: 540 }),    
   scalePoint({ x: 1460, y: 595 }),
   scalePoint({ x: 1460, y: 675 }), 
   scalePoint({ x: 1500, y: 710 }),
  ],
},
    ],

    label: scalePoint({ x: 1417, y: 598 }),

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

    polygons: [
{ 
  //Polygon 8
 depth: 1,
  points:[
   scalePoint({ x: 1252, y: 445 }),
   scalePoint({ x: 1354, y: 336 }),   
   scalePoint({ x: 1455, y: 414 }),
   scalePoint({ x: 1435, y: 510 }),
  ],
},
{
 //Polygon 9
  depth: 2,
  points:[
   scalePoint({ x: 1354, y: 336 }),
   scalePoint({ x: 1396, y: 281 }),
   scalePoint({ x: 1503, y: 336 }), 
   scalePoint({ x: 1455, y: 414 }),    
  ],
},
{
 //Polygon 10
  depth: 2,
  points:[
   scalePoint({ x: 1503, y: 336 }), 
   scalePoint({ x: 1455, y: 414 }),
   scalePoint({ x: 1435, y: 510 }),
   scalePoint({ x: 1480, y: 540 }),    
  ],
},
    ],

    label: scalePoint({ x: 1375, y: 430 }),
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

    polygons: [
{
  //Polygon 4
 depth: 2,
  points:[
   scalePoint({ x: 1129, y: 288 }),
   scalePoint({ x: 1141, y: 293 }),
   scalePoint({ x: 1252, y: 445 }),   
  ],
},
{ 
  //Polygon 5
 depth: 1,
  points:[
   scalePoint({ x: 1141, y: 293 }),
   scalePoint({ x: 1252, y: 445 }),
   scalePoint({ x: 1354, y: 336 }),   
   scalePoint({ x: 1313, y: 258 }),
  ],
},
{
 //Polygon 6
  depth: 2,
  points:[
   scalePoint({ x: 1354, y: 336 }),
   scalePoint({ x: 1313, y: 258 }), 
   scalePoint({ x: 1347, y: 221 }),
   scalePoint({ x: 1396, y: 281 }),    
  ],
},
{
 //Polygon 7
  depth: 2,
  points:[
   scalePoint({ x: 1060, y: 260 }),
   scalePoint({ x: 1141, y: 293 }), 
   scalePoint({ x: 1313, y: 258 }),
   scalePoint({ x: 1347, y: 221 }),    
  ],
},
],

    label: scalePoint({ x: 1260, y: 340 }),
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
 
polygons: [
{ 
  //Polygon Hitbox Beczki
 depth: 100,
  points:[
   
   scalePoint({ x: 873, y: 210 }), // 2
   scalePoint({ x: 873, y: 270 }), // 2'
   scalePoint({ x: 950, y: 315 }), // 4'
   scalePoint({ x: 950, y: 235 }), // 4 

  ],
},
{ 
  //Polygon 2
 depth: 2,
  points:[
   scalePoint({ x: 949,  y: 274.5 }),
   scalePoint({ x: 1060, y: 260 }),
   scalePoint({ x: 1129, y: 288 }),   
  ],
},
{
 //Polygon 3
  depth: 3,
  points:[
   scalePoint({ x: 954,  y: 280 }),
   scalePoint({ x: 949,  y: 274.5 }), 
   scalePoint({ x: 1129, y: 288 }),
   scalePoint({ x: 1133, y: 293 }),    
  ],
},
],


    label: scalePoint({ x: 1006, y: 305 }),
    
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

    polygons: [
      {
        // Polygon 17
        depth: 1,
        points: [
          //scalePoint({ x: 920, y: 800 }),
          scalePoint({ x: 960, y: 805 }),
          scalePoint({ x: 1040, y: 823 }),
          scalePoint({ x: 1060, y: 872.5 }),
          //scalePoint({ x: 1130, y: 870 }),
          scalePoint({ x: 930, y: 875 }),
        ],
      },
      {
        // Polygon 18
        depth: 2,
        points: [
          scalePoint({ x: 920, y: 800 }),
          scalePoint({ x: 960, y: 805 }),
          //scalePoint({ x: 1040, y: 823 }),
          //scalePoint({ x: 1060, y: 871 }),
          //scalePoint({ x: 1130, y: 870 }),
          scalePoint({ x: 930, y: 875 }),
        ],
      },
      {
        // Polygon Hitbox Logo
        depth: 100,
        points: [
        scalePoint({  x: 1060, y: 900  }),
        scalePoint({  x: 1130, y: 900  }),
        scalePoint({  x: 1130, y: 840  }),
        scalePoint({  x: 1060, y: 840  }),
        ],
      },
    ],

    label: scalePoint({ x: 1050, y: 890 }),

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

    polygons: [
      {
        //Polygon Hitbox Czujnego Pionu
        depth: 100,
        points: [
          scalePoint({  x: 1120, y: 780  }),
          scalePoint({  x: 1250, y: 800  }),
          scalePoint({  x: 1130, y: 900  }),
          scalePoint({  x: 1130, y: 840  }),
          
         
        ],
      },
    ],

    label: scalePoint({ x: 1205, y: 815 }),

    fill: "#ffffff",
    settingDate: "2026-05-08",
    removalDate: "2026-06-20",
    author: "Routesetter Karma",
    description: "Prawy dolny fragment centralnej bryły; pion i delikatne ustawienia na balans.",
  },

  // polygon: [
  //   scalePoint({ x: 1217, y: 711 }),
  //   scalePoint({ x: 1117, y: 861 }),
  //   scalePoint({ x: 1143, y: 879 }),
  //   scalePoint({ x: 1243, y: 729 }),
  // ],

  // ─── S09: MAŁY PRZEWIS — prawa górna krawędź hexagonu (linia: H2→H3) ──────
  {
    id: "s09",
    code: "9",
    name: "Mały przewis",
    shortName: "Mały przewis",

    polygons: [
      {
        // Polygon 23
        depth: 3,
        points: [
          scalePoint({ x: 1150, y: 590 }),
          scalePoint({ x: 1230, y: 720 }),
          scalePoint({ x: 1183.5, y: 790 }),
          scalePoint({ x: 1133, y: 722 }),
        ],
      },
    ],

    label: scalePoint({ x: 1230, y: 650 }),

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

    polygons: [
      {
        // Polygon 22
        depth: 2,
        points: [
          scalePoint({ x: 1150, y: 590 }),
          scalePoint({ x: 1133, y: 722 }),
          scalePoint({ x: 1111, y: 726 }),
          scalePoint({ x: 981, y: 668 }),
          scalePoint({ x: 970, y: 630 }),
        ],
      },
    ],

    label: scalePoint({ x: 1048, y: 593 }),

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

    polygons: [
  { 
  //Polygon 19
 depth: 2,
  points:[
   scalePoint({ x: 960, y: 805 }),
   scalePoint({ x: 920, y: 800 }),   
   scalePoint({ x: 920, y: 715 }),
  ],
},
{
 //Polygon 20
  depth: 2,
  points:[
   scalePoint({ x: 960, y: 805 }),
   scalePoint({ x: 920, y: 715 }),
   scalePoint({ x: 970, y: 630 }),
   scalePoint({ x: 981, y: 668 }),    
  ],
},
{
 //Polygon 21
  depth: 1,
  points:[
   scalePoint({ x: 1040, y: 823 }), 
   scalePoint({ x: 960, y: 805 }),
   scalePoint({ x: 981, y: 668 }),
   scalePoint({ x: 1111, y: 726 }),    
  ],
},
  ],

    label: scalePoint({ x: 880, y: 715 }),
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
   polygons: 
   [
    { 
  //PolygonR1
 depth: 4,
  points:[
   scalePoint({ x: 555, y: 647 }), // 6 spray
   scalePoint({ x: 575, y: 620 }), // 8 spray
   scalePoint({ x: 575, y: 510 }), // 9' spray   
   scalePoint({ x: 565, y: 510 }), // 9 spray   
   
  ],
},
    { 
  //PolygonR2
 depth: 3,
  points:[
   scalePoint({ x: 555, y: 647 }), // 6 spray
   scalePoint({ x: 595, y: 681.5 }), // 7 spray   
   scalePoint({ x: 575, y: 620 }), // 8 spray
  ],
},
{
 //PolygonM
  depth: 2,
  points:[
   scalePoint({ x: 555, y: 854 }), // 5 spray
   scalePoint({ x: 595, y: 819.5 }), // 4 spray
   scalePoint({ x: 595, y: 681.5 }), // 7 spray
   scalePoint({ x: 555, y: 647 }), // 6 spray   
  ],
},
{
 //PolygonL1
  depth: 3,
  points:[
   scalePoint({ x: 555, y: 854 }), // 5 spray
   scalePoint({ x: 575, y: 881 }), // 3 spray
   scalePoint({ x: 595, y: 819.5 }), // 4 spray   
  ],
},
{
 //PolygonL2
  depth: 4,
  points:[
   scalePoint({ x: 555, y: 854 }), // 5 spray
   scalePoint({ x: 575, y: 881 }), // 3 spray
   scalePoint({ x: 575, y: 992 }), // 2' spray   
   scalePoint({ x: 565, y: 992 }), // 2 spray   
  ],
},
   ],
    label: scalePoint({ x: 640, y: 752}),
    fill: "#ffffff",
    settingDate: "2026-06-01",
    removalDate: "2026-08-01",
    author: "Routesetter Karma",
    description: "Wszechstronne narzędzie do osiągania Twoich celów wspinaczkowych",
  },];


// Wall segments — linie ścian (czarne kreski z referencji).

export const wallSegments: WallSegment[] = [

  // Slab: 
  { id: "seg-s01-1-main",       sectorId: "s01", name: "slab lewy main",                       start: scalePoint({ x: 1485, y: 865 }), end: scalePoint({ x: 1438, y: 936 }),  angleLabel: "slab" },
  { id: "seg-s01-2-main",       sectorId: "s01", name: "slab prawy main",                      start: scalePoint({ x: 1438, y: 936 }), end: scalePoint({ x: 1350, y: 980 }),  angleLabel: "slab" },
  { id: "seg-s01-3-main",       sectorId: "s01", name: "slab prawe V main",                    start: scalePoint({ x: 1350, y: 980 }), end: scalePoint({ x: 1343, y: 992 }), angleLabel: "slab" },
 
  // Prawy compwall:
  { id: "seg-s02-1-main",       sectorId: "s02", name: "Prawy comp V main",                    start: scalePoint({ x: 1460, y: 675 }),  end: scalePoint({ x: 1485, y: 745 }), angleLabel: "compwall" },
  
  { id: "seg-s02-2-main",       sectorId: "s02", name: "Prawy comp main main",                 start: scalePoint({ x: 1485, y: 745 }),  end: scalePoint({ x: 1485, y: 865 }), angleLabel: "compwall" },
  
  { id: "seg-s02-3",       sectorId: "s02", name: "kant prawy compwall/slab main",        start: scalePoint({ x: 1505, y: 835 }),  end: scalePoint({ x: 1485, y: 865 }), angleLabel: "compwall" }, 
  
  { id: "seg-s02-4.1",     sectorId: "s02", name: "kant prawe V/prawy compwall",          start: scalePoint({ x: 1485, y: 745 }),  end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 
  { id: "seg-s02-4.2",     sectorId: "s02", name: "kant prawe V/lewy compwall",           start: scalePoint({ x: 1460, y: 675 }),  end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 
  
  { id: "seg-s02-5",       sectorId: "s02", name: "Prawy compwall pdst.",                 start: scalePoint({ x: 1500, y: 710 }),  end: scalePoint({ x: 1505, y: 835 }), angleLabel: "compwall" },
 

  // Lewy compwall:
   { id: "seg-s03-1.2-main",    sectorId: "s03", name: "Lewy comp V main",                     start: scalePoint({ x: 1435, y: 510 }),  end: scalePoint({ x: 1460, y: 595 }),  angleLabel: "compwall" },
   { id: "seg-s03-1.2-main",    sectorId: "s03", name: "Lewy comp main main",                  start: scalePoint({ x: 1460, y: 595 }),  end: scalePoint({ x: 1460, y: 675 }),  angleLabel: "compwall" },
   
   { id: "seg-s03-2",      sectorId: "s03", name: "kant lewe V/prawy compwall ",          start: scalePoint({ x: 1480, y: 540 }),  end: scalePoint({ x: 1460, y: 595 }), angleLabel: "compwall" },  
   
   { id: "seg-s03-3",      sectorId: "s03", name: "kant lewy compwall/prawy dach",        start: scalePoint({ x: 1435, y: 510 }),  end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" }, 
   
   { id: "seg-s03-4",      sectorId: "s03", name: "kant prawe V/lewy compwall",           start: scalePoint({ x: 1460, y: 675 }),  end: scalePoint({ x: 1500, y: 710 }), angleLabel: "compwall" }, 
   
   { id: "seg-s03-5",      sectorId: "s03", name: "Lewy compwall pdst.",                  start: scalePoint({ x: 1500, y: 710 }),  end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" },

  // Prawy dach:
   { id: "seg-s04-1-main",      sectorId: "s04", name: "Prawy dach main",                      start: scalePoint({ x: 1252, y: 445 }),  end: scalePoint({ x: 1435, y: 510 }), angleLabel: "dach" },
  
   { id: "seg-s04-2",      sectorId: "s04", name: "prawy dach dolne środkowe przełamanie",start: scalePoint({ x: 1354, y: 336 }),  end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   
   { id: "seg-s04-3.1",    sectorId: "s04", name: "prawy dach pdst.",                     start: scalePoint({ x: 1396, y: 281 }),  end: scalePoint({ x: 1503, y: 336 }), angleLabel: "dach" },
   { id: "seg-s04-3.2",    sectorId: "s04", name: "prawy dach pdst. styczna z lewy comp", start: scalePoint({ x: 1503, y: 336 }),  end: scalePoint({ x: 1480, y: 540 }), angleLabel: "dach" },
   
   { id: "seg-s04-4.1",    sectorId: "s04", name: "prawy/lewy dach środek góra",          start: scalePoint({ x: 1354, y: 336 }),  end: scalePoint({ x: 1252, y: 445 }), angleLabel: "dach" }, // frag=4
   { id: "seg-s04-4.2",    sectorId: "s04", name: "prawy/lewy dach środek dół",           start: scalePoint({ x: 1396, y: 281 }),  end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   
   { id: "seg-s04-5.1",    sectorId: "s04", name: "prawy dach środek bok",                start: scalePoint({ x: 1503, y: 336 }),  end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   { id: "seg-s04-5.2",    sectorId: "s04", name: "prawy dach środek góra",               start: scalePoint({ x: 1435, y: 510 }),  end: scalePoint({ x: 1455, y: 414 }), angleLabel: "dach" },
   
   { id: "seg-s04-6",      sectorId: "s04", name: "kant lewy compwall/prawy dach",        start: scalePoint({ x: 1435, y: 510 }),  end: scalePoint({ x: 1480, y: 540 }), angleLabel: "compwall" }, 


  // Lewy dach:
   { id: "seg-s05-1-main",      sectorId: "s05", name: "Lewy dach main",                       start: scalePoint({ x: 1128, y: 288 }),  end: scalePoint({ x: 1252, y: 445 }), angleLabel: "dach" },
   
   { id: "seg-s05-2.1",    sectorId: "s05", name: "lewy dach górne środkowe przełamanie", start: scalePoint({ x: 1141, y: 293 }),  end: scalePoint({ x: 1252, y: 445 }), angleLabel: "dach" },
   { id: "seg-s05-2.2",    sectorId: "s05", name: "lewy dach dolne środkowe przełamanie", start: scalePoint({ x: 1313, y: 258 }),  end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   
   { id: "seg-s05-3.1",    sectorId: "s05", name: "lewy dach środek góra",                start: scalePoint({ x: 1354, y: 336 }),  end: scalePoint({ x: 1252, y: 445 }), angleLabel: "dach" }, 
   { id: "seg-s05-3.2",    sectorId: "s05", name: "lewy dach środek dół",                 start: scalePoint({ x: 1396, y: 281 }),  end: scalePoint({ x: 1354, y: 336 }), angleLabel: "dach" },
   
   { id: "seg-s05-4.1",    sectorId: "s05", name: "lewy dach górne boczne przełamanie",   start: scalePoint({ x: 1141, y: 293 }),  end: scalePoint({ x: 1313, y: 258 }), angleLabel: "dach" },
   { id: "seg-s05-4.2",    sectorId: "s05", name: "lewy dach dolne boczne przełamanie",   start: scalePoint({ x: 1347, y: 221 }),  end: scalePoint({ x: 1313, y: 258 }), angleLabel: "dach" },
   { id: "seg-s05-2.8",    sectorId: "s05", name: "beczka/lewy dach dół",                 start: scalePoint({ x: 1060, y: 260 }),  end: scalePoint({ x: 1141, y: 293 }), angleLabel: "dach" },
   
   { id: "seg-s05-5.1",    sectorId: "s05", name: "lewy dach pdst.",                      start: scalePoint({ x: 1347, y: 221 }),  end: scalePoint({ x: 1396, y: 281}),  angleLabel: "dach" }, 
   { id: "seg-s05-5.2",    sectorId: "s05", name: "lewy dach pdst. styczna z beczką",     start: scalePoint({ x: 1347, y: 221 }),  end: scalePoint({ x: 1060, y: 260 }), angleLabel: "dach" },
   
  // Beczka:
  { id: "seg-s06-1-main",       sectorId: "s06", name: "beczka main V",                        start: scalePoint({ x: 873,  y: 239 }),  end: scalePoint({ x: 880, y: 245 }),  angleLabel: "beczka" },  
  
  { id: "seg-s06-2-main",       sectorId: "s06", name: "Beczka slab main",                     start: scalePoint({ x: 880,  y: 245 }),  end: scalePoint({ x: 950, y: 275 }),  angleLabel: "beczka" },
  
  { id: "seg-s06-3-main",       sectorId: "s06", name: "Beczka main main",                     start: scalePoint({ x: 950,  y: 275 }),  end: scalePoint({ x: 1127, y: 288 }), angleLabel: "beczka" },
  
  { id: "seg-s06-4",       sectorId: "s06", name: "Beczka przełamanie do pionu",          start: scalePoint({ x: 954,  y: 280 }),  end: scalePoint({ x: 1131, y: 293 }), angleLabel: "beczka" },
  
  { id: "seg-s06-5",       sectorId: "s06", name: "beczka pdst.",                         start: scalePoint({ x: 950,  y: 275 }),  end: scalePoint({ x: 1060, y: 260 }), angleLabel: "beczka" },
  
  { id: "seg-s06-7",       sectorId: "s06", name: "beczka/lewy dach dół",                 start: scalePoint({ x: 1060, y: 260 }),  end: scalePoint({ x: 1127, y: 288 }), angleLabel: "beczka" },
  
  { id: "seg-s06-8",       sectorId: "s06", name: "beczka/lewy dach mikro góra",          start: scalePoint({ x: 1127, y: 288 }),  end: scalePoint({ x: 1131, y: 293 }), angleLabel: "beczka" },
  
  { id: "seg-s06-9",       sectorId: "s06", name: "Beczka slab ",                         start: scalePoint({ x: 954,  y: 280 }),  end: scalePoint({ x: 949, y: 275 }),  angleLabel: "beczka" },
  
// ═══ GRZYB ═══

  // Logo:
  { id: "seg-hex-s07-1.1-main",   sectorId: "s07", name: "logo main front",                      start: scalePoint({ x: 1060, y: 872}),  end: scalePoint({ x: 930, y: 875}),   angleLabel: "hex" },
  { id: "seg-hex-s07-1.2-main",   sectorId: "s07", name: "logo main front",                      start: scalePoint({ x: 1130, y: 870 }),  end: scalePoint({ x: 1060, y: 872}),   angleLabel: "hex" },
  
  { id: "seg-hex-s07-2-main",   sectorId: "s07", name: "logo main przewis",                    start: scalePoint({ x: 930, y: 875}),    end: scalePoint({ x: 920, y: 800}),   angleLabel: "hex" },  
  
  { id: "seg-hex-s07-3",   sectorId: "s07", name: "kant lewego przewisu z logiem",        start: scalePoint({ x: 930, y: 875 }),   end: scalePoint({ x: 960, y: 805 }),    angleLabel: "hex" },
  
  { id: "seg-hex-s07-4.1", sectorId: "s07", name: "dolny kant duży i lewy przewis logo",  start: scalePoint({ x: 960, y: 805 }),   end: scalePoint({ x: 1040, y: 823 }),   angleLabel: "hex" },
  { id: "seg-hex-s07-4.2", sectorId: "s07", name: "górny kant duży i lewy przewis logo",  start: scalePoint({ x: 960, y: 805 }),   end: scalePoint({ x: 920, y: 800 }),    angleLabel: "hex" },
  
  { id: "seg-hex-s07-5",   sectorId: "s07", name: "lewy przewis logo pdst.",              start: scalePoint({ x: 1060, y: 871 }),  end: scalePoint({ x: 1040, y: 823 }),  angleLabel: "hex" },
  
  
  // Czujny pion:
  { id: "seg-hex-s08-1-main",     sectorId: "s08", name: "Czujny pion main",                     start: scalePoint({ x: 1230, y: 720 }),  end: scalePoint({ x: 1130, y: 870 }),  angleLabel: "hex" },
  
  // Mały przewis:
  { id: "seg-hex-s09-1-main",     sectorId: "s09", name: "Mały przewis main",                    start: scalePoint({ x: 1150, y: 590 }),  end: scalePoint({ x: 1230, y: 720 }),  angleLabel: "hex" },
  
  { id: "seg-hex-s09-2",   sectorId: "s09", name: "kant średniego i małego przewisu",     start: scalePoint({ x: 1150, y: 590 }),  end: scalePoint({ x: 1133, y: 722 }),  angleLabel: "hex" },
  
  { id: "seg-hex-s09-3", sectorId: "s09", name: "mały przewis pdst.",                   start: scalePoint({ x: 1133, y: 722 }),  end: scalePoint({ x: 1183.5, y: 790 }),  angleLabel: "hex" },
  
  { id: "seg-hex-s08-4",     sectorId: "s09", name: "kant czujny pion i mały przewis",      start: scalePoint({ x: 1230, y: 720 }),  end: scalePoint({ x: 1183.5, y: 790 }),angleLabel: "hex" },
    
  
  // Średni przewis: 
  { id: "seg-hex-s10-1-main",     sectorId: "s10", name: "średni przewis main",                  start: scalePoint({ x: 970, y: 630 }),   end: scalePoint({ x: 1150, y: 590 }),  angleLabel: "hex" },
  
  { id: "seg-hex-s10-2.1", sectorId: "s10", name: "górny kant duży i średni przewis",     start: scalePoint({ x: 970, y: 630 }),   end: scalePoint({ x: 981, y: 668 }),   angleLabel: "hex" },
  { id: "seg-hex-s10-2.2",   sectorId: "s10", name: "dolny kant duży i średni przewis",     start: scalePoint({ x: 981, y: 668 }),   end: scalePoint({ x: 1111, y: 726 }),  angleLabel: "hex" },

  { id: "seg-hex-s10-3", sectorId: "s10", name: "średni przewis pdst.",                 start: scalePoint({ x: 1111, y: 726 }),  end: scalePoint({ x: 1133, y: 722 }), angleLabel: "hex" },
  
  { id: "seg-hex-s10-4",   sectorId: "s10", name: "kant średniego i małego przewisu",     start: scalePoint({ x: 1150, y: 590 }),  end: scalePoint({ x: 1133, y: 722 }), angleLabel: "hex" },

  
  // Duży przewis:
  { id: "seg-hex-s11-1 main",   sectorId: "s11", name: "Duży przewis main",                     start: scalePoint({ x: 920, y: 715 }),   end: scalePoint({ x: 970, y: 630 }),   angleLabel: "hex" },
  
  { id: "seg-hex-s11-2 main",   sectorId: "s11", name: "Duży przewis V main",                   start: scalePoint({ x: 920, y: 715 }),   end: scalePoint({ x: 920, y: 800 }),   angleLabel: "hex" },
  
  { id: "seg-hex-s11-3.1",   sectorId: "s11", name: "przełamanie środek duży przewis",       start: scalePoint({ x: 981, y: 668 }),   end: scalePoint({ x: 960, y: 805 }),   angleLabel: "hex" },
  { id: "seg-hex-s11-3.2",   sectorId: "s11", name: "przełamanie bok duży przewis",          start: scalePoint({ x: 920, y: 715 }),   end: scalePoint({ x: 960, y: 805 }),   angleLabel: "hex" },
  
  { id: "seg-hex-s11-4.1", sectorId: "s11", name: "dolny kant duży i średni przewis",      start: scalePoint({ x: 981, y: 668 }),   end: scalePoint({ x: 1111, y: 726 }),  angleLabel: "hex" },
  { id: "seg-hex-s11-4.2", sectorId: "s11", name: "górny kant duży i średni przewis",      start: scalePoint({ x: 970, y: 630 }),   end: scalePoint({ x: 981, y: 668 }),   angleLabel: "hex" },
  
  { id: "seg-hex-s11-5",   sectorId: "s11", name: "duży przewis pdst.",                    start: scalePoint({ x: 1111, y: 726 }),  end: scalePoint({ x: 1040, y: 823 }), angleLabel: "hex" },

  { id: "seg-hex-s11-6.1", sectorId: "s11", name: "dol. kant duży i lewy przewisy logo",   start: scalePoint({ x: 960, y: 805 }),   end: scalePoint({ x: 1040, y: 823 }),  angleLabel: "hex" },
  { id: "seg-hex-s11-6.2", sectorId: "s11", name: "gór. kant duży i lewy przewis logo",    start: scalePoint({ x: 960, y: 805 }),   end: scalePoint({ x: 920, y: 800 }),   angleLabel: "hex" },
       

  // ═══ SPRAYWALL ═══
  { id: "seg-s12-1-main",     sectorId: "s12", name: "prawy pionik main",                    start: scalePoint({ x: 565,  y: 510}),   end: scalePoint({ x: 655,  y: 510  }), angleLabel: "spraywall" },
  
  { id: "seg-s12-2.1-main",   sectorId: "s12", name: "prawy przewisik main",                 start: scalePoint({ x: 575,  y: 510 }),  end: scalePoint({ x: 575,  y: 620  }), angleLabel: "spraywall" },
  { id: "seg-s12-2.2",        sectorId: "s12", name: "prawy przewisik pdst.",                start: scalePoint({ x: 555,  y: 647 }),  end: scalePoint({ x: 565,  y: 510  }), angleLabel: "spraywall" },
  
  { id: "seg-s12-3.1",        sectorId: "s12", name: "kant prawe wcięcie/prawy przewisik",   start: scalePoint({ x: 575,  y: 620 }),    end: scalePoint({ x: 555,  y: 647  }), angleLabel: "spraywall" },
  { id: "seg-s12-3.2",        sectorId: "s12", name: "kant prawe wcięcie/środek przewis",    start: scalePoint({ x: 595,  y: 681.5 }),  end: scalePoint({ x: 555,  y: 647 }), angleLabel: "spraywall" },
  { id: "seg-s12-3.3-main",   sectorId: "s12", name: "prawe wcięcie main",                   start: scalePoint({ x: 595,  y: 681.5 }),  end: scalePoint({ x: 575,  y: 620}), angleLabel: "spraywall" }, 

  { id: "seg-s12-4.1-main",   sectorId: "s12", name: "środek przewis main",                  start: scalePoint({ x: 595,  y: 819.5 }),end: scalePoint({ x: 595,  y: 681.5  }),angleLabel: "spraywall"},
  { id: "seg-s12-4.2",        sectorId: "s12", name: "środek przewis pdst.",                 start: scalePoint({ x: 555,  y: 854 }),  end: scalePoint({ x: 555,  y: 647 }), angleLabel: "spraywall" },

  { id: "seg-s12-5.1",        sectorId: "s12", name: "kant lewe wcięcie/lewy przewisik",     start: scalePoint({ x: 575,  y: 881 }),end: scalePoint({ x: 555,  y: 854 }), angleLabel: "spraywall" },
  { id: "seg-s12-5.2",        sectorId: "s12", name: "kant lewe wcięcie/środek przewis",     start: scalePoint({ x: 595,  y: 819.5 }),end: scalePoint({ x: 555,  y: 854 }), angleLabel: "spraywall" },
  { id: "seg-s12-5.3-main",   sectorId: "s12", name: "Lewe wcięcie main",                    start: scalePoint({ x: 595,  y: 819.5 }),end: scalePoint({ x: 575,  y: 881}),angleLabel: "spraywall"},
  
  { id: "seg-s12-6.1-main",   sectorId: "s12", name: "lewy przewisik main",                  start: scalePoint({ x: 575,  y: 881 }),end: scalePoint({ x: 575,  y: 992 }), angleLabel: "spraywall" },
  { id: "seg-s12-6.2",        sectorId: "s12", name: "lewy przewisik pdst.",                 start: scalePoint({ x: 555,  y: 854 }),  end: scalePoint({ x: 565,  y: 992 }), angleLabel: "spraywall" },
  

  { id: "seg-s12-7-main",     sectorId: "s12", name: "lewy pionik main",                     start: scalePoint({ x: 655,  y: 992 }),  end: scalePoint({ x: 565,  y: 992 }), angleLabel: "spraywall" },
];

/**
 * Linie materaca (mat lines) — szare linie okalające sektory.
 */
export const matLines: Array<{ id: string; start: Point; end: Point; dashed?: boolean}> = [
  
  { id: "mat-00",                                              start: scalePoint({ x: 785, y: 239 }),   end: scalePoint({ x: 873, y: 239 }) },
  { id: "mat-01",                                              start: scalePoint({ x: 785, y: 239 }),   end: scalePoint({ x: 785, y: 333 }) },   
  { id: "mat-02",                                              start: scalePoint({ x: 784, y: 333 }),   end: scalePoint({ x: 848, y: 372 }) },
  { id: "mat-03",                                              start: scalePoint({ x: 848, y: 372 }),   end: scalePoint({ x: 908, y: 390 }) },
  { id: "mat-04",                                              start: scalePoint({ x: 908, y: 390 }),   end: scalePoint({ x: 1066, y: 386 })},
  { id: "mat-05",                                              start: scalePoint({ x: 1066, y: 386 }),  end: scalePoint({ x: 1044, y: 523 })},  
  { id: "mat-06",                                              start: scalePoint({ x: 1044, y: 523 }),  end: scalePoint({ x: 911, y: 560 }) },
  { id: "mat-07",                                              start: scalePoint({ x: 911, y: 560 }),   end: scalePoint({ x: 826, y: 733 }) },   
  { id: "mat-08",                                              start: scalePoint({ x: 826, y: 733 }),   end: scalePoint({ x: 828, y: 931 }) },
  { id: "mat-09",                                              start: scalePoint({ x: 828, y: 931 }),   end: scalePoint({ x: 869, y: 994 }) },
  { id: "mat-10",                                              start: scalePoint({ x: 869, y: 994 }),   end: scalePoint({ x: 1165, y: 964 })},
  { id: "mat-11",                                              start: scalePoint({ x: 1165, y: 964 }),  end: scalePoint({ x: 1329, y: 735 })},
  { id: "mat-12",                                              start: scalePoint({ x: 1329, y: 735 }),  end: scalePoint({ x: 1385, y: 772 })},
  { id: "mat-13",                                              start: scalePoint({ x: 1385, y: 772 }),  end: scalePoint({ x: 1296, y: 904 })},  
  { id: "mat-14",                                              start: scalePoint({ x: 1296, y: 904 }),  end: scalePoint({ x: 1296, y: 992 })},
  { id: "mat-15",                                              start: scalePoint({ x: 1296, y: 992 }),  end: scalePoint({ x: 1343, y: 992 })},

  { id: "spraywall-mat-1-krókie v1",                           start: scalePoint({ x: 655,  y: 992 }),  end: scalePoint({ x: 680,  y: 985 })},
  { id: "spraywall-mat-2-długi",                               start: scalePoint({ x: 680,  y: 985 }),  end: scalePoint({ x: 680, y: 517 })},
  { id: "spraywall-mat-3-krótkie v2",                          start: scalePoint({ x: 680,  y: 517 }),  end: scalePoint({ x: 655,  y: 510 })},

  //{ id: "campus-1",                                            start: scalePoint({ x: 565, y: 508 }),   end: scalePoint({ x: 655, y: 508 })},
  //{ id: "campus-2",                                            start: scalePoint({ x: 565, y: 508 }),   end: scalePoint({ x: 565, y: 445 })},
  //{ id: "campus-3",                                            start: scalePoint({ x: 655, y: 508 }),   end: scalePoint({ x: 655, y: 445 })},
  //{ id: "campus-4",                                            start: scalePoint({ x: 565, y: 445 }),   end: scalePoint({ x: 655, y: 445 })},
  
  //{ id: "campus-mat-1",                                        start: scalePoint({ x: 565, y: 397 }),   end: scalePoint({ x: 565, y: 460 })},
  //{ id: "campus-mat-2",                                        start: scalePoint({ x: 565, y: 397 }),   end: scalePoint({ x: 655, y: 397 })},
  //{ id: "campus-mat-3",                                        start: scalePoint({ x: 655, y: 397 }),   end: scalePoint({ x: 655, y: 445 })},
  
  { id: "siłownia-1-wzdłuż maty beczki",                       start: scalePoint({ x: 785, y: 239 }),   end: scalePoint({ x: 785, y: 333 })},
  { id: "siłownia-2-wzdłuż maty beczki",                       start: scalePoint({ x: 785, y: 333 }),   end: scalePoint({ x: 848, y: 372 })},
  { id: "siłownia-3-wzdłuż krótkiej krawędzi drążków",         start: scalePoint({ x: 848, y: 372 }),   end: scalePoint({ x: 848, y: 509 })},
  { id: "siłownia-4-odgrodzenie od spraywall, wzdłuż campusa", start: scalePoint({ x: 848, y: 509 }),   end: scalePoint({ x: 565, y: 509 })},
  { id: "siłownia-6-odgrodzenie od fitnessu",                  start: scalePoint({ x: 565, y: 239 }),   end: scalePoint({ x: 565, y: 509 })},
  { id: "siłownia-7-odgrodzenie od ogródka",                   start: scalePoint({ x: 565, y: 239 }),   end: scalePoint({ x: 785, y: 239 })},

];

/**
 * Przykładowe bouldery — fallback gdy Supabase nie odpowiada.
 * Pozycje dostosowane do nowej geometrii liniowej.
 */
export const boulderPins: BoulderPin[] = [];

export const getSectorById = (id: string) => sectors.find((sector) => sector.id === id);
export const getSegmentById = (id: string) => wallSegments.find((segment) => segment.id === id);
export const getHoldColor = (key: HoldColorKey) => HOLD_COLORS[key];
export const getGradeColor = (grade: BoulderGrade) => GRADE_COLORS[grade];
