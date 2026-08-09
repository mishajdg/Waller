/**
 * Iteracja 11 — Portrait map (800×1600) + naprawiony drag/pan na telefonie
 * =========================================================================
 * - Mapa pionowa 800×1600 SVG units (proporcje ekranu telefonu)
 * - Drag/pan działa jak Google Maps: touch i mouse
 * - Viewport (okienko) pokazuje ~50% mapy — reszta dostępna przez drag
 * - Zoom sektora centruje go w okienku
 */
import { decorativeLabels } from "@/data/decorativeLabels";
import { backgroundPolygons } from "../data/backgroundPolygons";
import { depthToFill } from "@/data/polygonStyles";
import { getSegmentImportance, importanceToStyle } from "@/data/lineStyles";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent,} from "react";
import type { BoulderPin, Point, Sector, Selection, WallSegment } from "../types";
import { getGradeColor, getHoldColor, MAP_SIZE, matLines } from "../data/gymMap";
import { getBouldersForSectorSorted } from "../lib/boulderLayout";
import { polygonToPoints } from "../lib/geometry";

type WallMapProps = {
  sectors: Sector[];
  segments: WallSegment[];
  boulders: BoulderPin[];
  selection: Selection;
  isAdmin?: boolean;
  onSelectSector: (sectorId: string) => void;
  onSelectBoulder: (boulderId: string) => void;
  onZoomSectorChange?: (sectorId: string | null) => void;
  onClearSelection?: () => void;
};

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * FULL_VIEW_BOX — "okienko" startowe.
 *
 * Iteracja 19: Mapa powiększona do 3200×1400 SVG units.
 * Sektory zajmują środkową część (x≈560–2660, y≈280–1130).
 * Startowy viewBox wycentrowany na modelu ścianki:
 *   cx = (560+2660)/2 = 1610 → x = 1610 - 300 = 1310
 *   cy = (280+1130)/2 = 705  → y = 705 - 450 = 255
 *
 * Proporcje okienka: VIEWPORT_W:VIEWPORT_H = 600:900 = 2:3 (portrait)
 * Na ekranie 390px szerokości → SVG ma height = 390*(900/600) = 585px
 */
// Bounding box ścianki (po WALL_OFFSET=-15,-8):
// Polygony: x=520–2710, y=235–1180 → po WALL_OFFSET: x=505–2695, y=227–1172
// Szerokość ścianki: 2190, wysokość: 945
// Margines 120 SVG units z każdej strony
// FULL_VIEW_BOX pokazuje CAŁĄ ściankę wycentrowaną z równym marginesem:
const WALL_PAD = 1;
const FULL_VIEW_BOX: ViewBox = {
  x: 2710 * WALL_PAD,          
  y: 2650* WALL_PAD,
  width: 2500,
  height: 2500,
};

// ============================================================
// WALL_OFFSET — Przesunięcie całej ścianki (sektory + matLines + segmenty)
// Zmień wartości poniżej, aby przesunąć mapę na białym canvas
// Dodatnie wartości = prawo/dół, ujemne = lewo/góra
// ============================================================
// WALL_OFFSET wyznaczony matematycznie:
// Bounding box polygonów: x=520–2710, y=235–1180
// Środek ścianki: (1615, 707.5) → Canvas środek: (1600, 700)
// Offset = canvas_center - wall_center = (1600-1615, 700-707.5) = (-15, -8)
// Po przesunięciu: marginesy równe ze wszystkich stron (~505 SVG units poziomo, ~228 pionowo)
const WALL_OFFSET = {
  x: 1380,   // Przesunięcie poziome: środek ścianki na środku canvasu
  y: 2250,   // Przesunięcie pionowe: środek ścianki na środku canvasu
};

// Granice całej mapy (z małym paddingiem)
const MAP_BOUNDS = {
  minX: 1350,
  minY: 1500,
  maxX: MAP_SIZE.width - 1250,
  maxY: MAP_SIZE.height - 1500,
};

const isActivationKey = (event: KeyboardEvent<SVGGElement>) =>
  event.key === "Enter" || event.key === " ";
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const viewBoxToString = (box: ViewBox) =>
  `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.width.toFixed(2)} ${box.height.toFixed(2)}`;

function getSectorLabelLines(sector: Sector) {
  const firstLine = sector.name;
  if (firstLine.length <= 18) return [firstLine];
  if (sector.name.includes(" compwall"))
    return [sector.name.replace(" compwall", ""), "compwall"];
  if (sector.name.includes(" przewis"))
    return [sector.name.replace(" przewis", ""), "przewis"];
  if (sector.name.includes(" dach"))
    return [sector.name.replace(" dach", ""), "dach"];  
  return [sector.shortName];
}

function getBounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),


    maxY: Math.max(...ys),
  };
}

function getZoomViewBox(sector: Sector, sectorBoulders: BoulderPin[], wallOffset: { x: number; y: number }): ViewBox {
  // Współrzędne sektorów są w przestrzeni PRZED WALL_OFFSET.
  // viewBox jest w przestrzeni SVG (po offsetcie).
  // Musimy dodać wallOffset do wszystkich punktów żeby zoom trafił w właściwe miejsce.
  const offset = (p: { x: number; y: number }) => ({ x: p.x + wallOffset.x, y: p.y + wallOffset.y });
  const allPoints = [
    ...sector.polygons.flatMap((polygon) => polygon.points.map(offset)),
    offset(sector.label),
    ...sectorBoulders.map((b) => offset(b.position)),
  ];
  const bounds = getBounds(allPoints);
  const padding = 80;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const offsetX = sector.cameraOffset?.x ?? 0
  const offsetY = sector.cameraOffset?.y ?? 0

  const zoomScale = sector.zoomScale ?? 1;

  // Okienko zoomu ma te same proporcje co FULL_VIEW_BOX
  const zoomW = Math.max(300, bounds.maxX - bounds.minX + padding * 2) * zoomScale;
  const zoomH = Math.max(300, bounds.maxY - bounds.minY + padding * 2) * zoomScale;

  let x = cx - zoomW / 2 + offsetX;
  let y = cy - zoomH / 2 + 300 + offsetY; // + kompensacja wysokości drawera (żeby nie zasłaniał sektora)

  // Clamp do granic mapy
  x = clamp(x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX - zoomW);
  y = clamp(y, MAP_BOUNDS.minY, MAP_BOUNDS.maxY - zoomH);



  return { x, y, width: zoomW, height: zoomH };
}

export function WallMap({
  sectors,
  segments,
  boulders,
  selection,
  isAdmin = false,
  onSelectSector,
  onSelectBoulder,
  onZoomSectorChange,
  onClearSelection,
}: WallMapProps) {
  const [zoomedSectorId, setZoomedSectorId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(FULL_VIEW_BOX);
  const svgRef = useRef<SVGSVGElement>(null);

  // === PAN/DRAG STATE ===
  const isPanningRef = useRef(false);
  const [isPanningVisual, setIsPanningVisual] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; vb: ViewBox }>({
    clientX: 0,
    clientY: 0,
    vb: FULL_VIEW_BOX,
  });
  const hasDraggedRef = useRef(false);

  // === PINCH-TO-ZOOM STATE ===
  // Przechowuje dane dwóch palców przy starcie pincza
  const pinchStartRef = useRef<{
    dist: number;       // Odległość między palcami przy starcie
    midX: number;       // Środek między palcami przy starcie (client coords)
    midY: number;
    vb: ViewBox;        // viewBox przy starcie pincza
  } | null>(null);
  const isPinchingRef = useRef(false);

  // Minimalne i maksymalne powiększenie (w SVG units szerokości viewBox)
  // MIN_ZOOM_W = maksymalne przybliżenie (mały viewBox = duże przybliżenie)
  // MAX_ZOOM_W = maksymalne oddalenie (duży viewBox = mały zoom)
  const MIN_ZOOM_W = 300;              // Nie przybliżaj bardziej niż 300 SVG units
  const MAX_ZOOM_W = FULL_VIEW_BOX.width * 1.2; // Nie oddalaj bardziej niż 110% widoku startowego

  const selectedBoulderSectorId =
    selection?.type === "boulder"
      ? boulders.find((b) => b.id === selection.id)?.sectorId ?? null
      : null;
  const activeSectorId =
    zoomedSectorId ?? (selection?.type === "sector" ? selection.id : selectedBoulderSectorId);
  const zoomedSector = sectors.find((s) => s.id === zoomedSectorId) ?? null;

  // === ITERACJA 13: animacja viewBox ===
  // targetViewBox: cel animacji (zoom-in = sektor, zoom-out = FULL_VIEW_BOX)
  // animTrigger: licznik wymuszający restart animacji nawet gdy targetViewBox się nie zmienił
  // (np. zoom-out po dragu: targetViewBox = FULL_VIEW_BOX, ale viewBox był przesunięty)
  const [animTrigger, setAnimTrigger] = useState(0);

  const targetViewBox = useMemo(() => {
    if (!zoomedSector) return FULL_VIEW_BOX;
    return getZoomViewBox(zoomedSector, getBouldersForSectorSorted(boulders, zoomedSector.id), WALL_OFFSET);
  }, [boulders, zoomedSector]);

  // Animacja viewBox — uruchamia się przy zmianie targetViewBox LUB animTrigger
  useEffect(() => {
    const start = { ...viewBox };
    const end = targetViewBox;
    const duration = 380;
    const startTime = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = easeOutCubic(progress);
      setViewBox({
        x: start.x + (end.x - start.x) * eased,
        y: start.y + (end.y - start.y) * eased,
        width: start.width + (end.width - start.width) * eased,
        height: start.height + (end.height - start.height) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetViewBox, animTrigger]);

  const sortedZoomBoulders = useMemo(() => {
    if (!zoomedSectorId) return [];
    return getBouldersForSectorSorted(boulders, zoomedSectorId);
  }, [boulders, zoomedSectorId]);

  /**
   * Sprawdź czy punkt (w przestrzeni sektora, przed WALL_OFFSET) jest widoczny w viewBox.
   * viewBox jest w przestrzeni SVG (po WALL_OFFSET), więc dodajemy offset do porównania.
   *
   * Margines bardzo duży (1000 SVG units) — zapobiega znikaniu pinów przy krawędziach.
   * Przy FULL_VIEW_BOX.width=2430, margines 1000 = ~41% szerokości — pin jest widoczny
   * nawet gdy sektor jest częściowo poza okienkiem.
   */
  const isPointInViewBox = (pos: { x: number; y: number }, vb: ViewBox, margin = 1000) => {
    const px = pos.x + WALL_OFFSET.x;
    const py = pos.y + WALL_OFFSET.y;
    return (
      px >= vb.x - margin &&
      px <= vb.x + vb.width + margin &&
      py >= vb.y - margin &&
      py <= vb.y + vb.height + margin
    );
  };

  /**
   * Sektor jest widoczny jeśli jego środek (label) lub którykolwiek wierzchołek
   * jest w okienku z dużym marginesem.
   * Nie filtrujemy pinów osobno — jeśli sektor jest widoczny, wszystkie jego piny są widoczne.
   * To eliminuje bug znikania pinów przy krawędziach viewBox.
   */
  const isSectorInViewBox = (sector: Sector, vb: ViewBox): boolean => {
    if (isPointInViewBox(sector.label, vb)) return true;
    return sector.polygons.some((polygon) => polygon.points.some((pt) => isPointInViewBox(pt, vb)));
  };

  const visibleBoulders = zoomedSectorId
    ? sortedZoomBoulders
    : [...boulders]
        .filter((b) => {
          const sector = sectors.find((s) => s.id === b.sectorId);
          if (!sector) return false;
          // Pokaż pin jeśli sektor jest widoczny — nie filtrujemy pinów osobno
          // (podwójne filtrowanie powodowało znikanie pinów przy krawędziach)
          return isSectorInViewBox(sector, viewBox);
        })
        .sort((a, b) => {
          if (a.sectorId !== b.sectorId) return a.sectorId.localeCompare(b.sectorId);
          if (a.grade !== b.grade) return a.grade - b.grade;
          return a.id.localeCompare(b.id);
        });

  const clearZoom = () => {
    if (!zoomedSectorId) return;
    // === ITERACJA 13: zoom-out wraca do centrum mapy ===
    // setAnimTrigger wymusza restart animacji nawet jeśli targetViewBox
    // ma tę samą referencję (np. użytkownik drag-ował mapę po zoom-in
    // i viewBox nie jest już równy targetViewBox).
    setZoomedSectorId(null);
    onZoomSectorChange?.(null);
    onClearSelection?.();
    setAnimTrigger((n) => n + 1); // wymuś animację powrotu do FULL_VIEW_BOX
  };

  const activateSector = (sectorId: string) => {
    if (zoomedSectorId === sectorId) {
      // Tapnięcie już aktywnego sektora → zamknij drawer i wróć do widoku ogólnego
      clearZoom();
      return;
    }
    // Tapnięcie innego sektora przy otwartym drawerze → przełącz sektor bez zamykania drawera
    setZoomedSectorId(sectorId);
    onZoomSectorChange?.(sectorId);
    onSelectSector(sectorId);
  };

  const handleSectorClick = (event: MouseEvent<SVGGElement>, sector: Sector) => {
    if (hasDraggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    activateSector(sector.id);
  };

  const handleSegmentClick = (event: MouseEvent<SVGGElement>, segment: WallSegment) => {
    if (hasDraggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    activateSector(segment.sectorId);
  };

  // =========================================================================
  // PAN/DRAG — działa na touch i mouse
  // Logika: zapamiętujemy punkt startowy i viewBox startowy,
  // następnie przy każdym move przeliczamy delta w SVG units i przesuwamy viewBox.
  // =========================================================================

  const startPan = (clientX: number, clientY: number) => {
    isPanningRef.current = true;
    setIsPanningVisual(true);
    hasDraggedRef.current = false;
    panStartRef.current = { clientX, clientY, vb: { ...viewBox } };
  };

  const movePan = (clientX: number, clientY: number) => {
    if (!isPanningRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;

    const dx = clientX - panStartRef.current.clientX;
    const dy = clientY - panStartRef.current.clientY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasDraggedRef.current = true;
    }

    // Przelicz piksele ekranu → SVG units
    const rect = svg.getBoundingClientRect();
    const vb = panStartRef.current.vb;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;

    const newX = vb.x - dx * scaleX;
    const newY = vb.y - dy * scaleY;

    // Clamp — nie wychodź poza mapę
    const maxX = MAP_BOUNDS.maxX - vb.width;
    const maxY = MAP_BOUNDS.maxY - vb.height;

    setViewBox((prev) => ({
      ...prev,
      x: clamp(newX, MAP_BOUNDS.minX, Math.max(MAP_BOUNDS.minX, maxX)),
      y: clamp(newY, MAP_BOUNDS.minY, Math.max(MAP_BOUNDS.minY, maxY)),
    }));
  };

  const endPan = () => {
    isPanningRef.current = false;
    setIsPanningVisual(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 50);
  };

  // Mouse handlers
  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // tylko lewy przycisk
    startPan(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    movePan(e.clientX, e.clientY);
  };

  const handleMouseUp = () => endPan();
  const handleMouseLeave = () => endPan();

  // Touch handlers
  const handleTouchStart = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      // Dwa palce — start pincza
      e.preventDefault();
      isPanningRef.current = false;
      setIsPanningVisual(false);
      isPinchingRef.current = true;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      // Zapisujemy startowy stan pincza
      pinchStartRef.current = { dist, midX, midY, vb: { ...viewBox } };
      return;
    }
    if (e.touches.length !== 1) return;
    e.preventDefault(); // zapobiega scrollowi strony
    isPinchingRef.current = false;
    pinchStartRef.current = null;
    startPan(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && isPinchingRef.current && pinchStartRef.current) {
      // =====================================================================
      // PINCH MOVE — naturalne przybliżanie/oddalanie jak w Google Maps
      //
      // Algorytm:
      //  1. Oblicz aktualny dystans między palcami → skala zoomu
      //  2. Oblicz AKTUALNY środek między palcami (nie startowy!)
      //     → to pozwala mapie podążać za ruchem palców
      //  3. Przelicz środek na SVG units względem STARTOWEGO viewBox
      //  4. Oblicz nowy viewBox: środek pincza zostaje w tym samym miejscu
      //     na ekranie, ale skalujemy względem AKTUALNEGO środka
      //  5. Dodaj pan: przesuń viewBox o różnicę między startowym a aktualnym środkiem
      // =====================================================================
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const t0 = e.touches[0];
      const t1 = e.touches[1];

      // 1. Skala zoomu (względem startowego dystansu)
      const currentDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = pinchStartRef.current.dist / currentDist; // >1 = oddal, <1 = przybliż

      const startVb = pinchStartRef.current.vb;
      const newW = clamp(startVb.width * scale, MIN_ZOOM_W, MAX_ZOOM_W);
      const newH = newW * (startVb.height / startVb.width); // zachowaj proporcje ekranu

      const rect = svg.getBoundingClientRect();
      const svgScaleX = startVb.width / rect.width;
      const svgScaleY = startVb.height / rect.height;

      // 2. AKTUALNY środek między palcami (client coords)
      const curMidX = (t0.clientX + t1.clientX) / 2;
      const curMidY = (t0.clientY + t1.clientY) / 2;

      // 3. Startowy środek w SVG units (względem startowego viewBox)
      const startMidSvgX = startVb.x + (pinchStartRef.current.midX - rect.left) * svgScaleX;
      const startMidSvgY = startVb.y + (pinchStartRef.current.midY - rect.top) * svgScaleY;

      // 4. Nowy viewBox: startowy środek zostaje na tym samym miejscu po zoomie
      let newX = startMidSvgX - (startMidSvgX - startVb.x) * (newW / startVb.width);
      let newY = startMidSvgY - (startMidSvgY - startVb.y) * (newH / startVb.height);

      // 5. Pan: dodaj różnicę między startowym a aktualnym środkiem (w SVG units)
      //    Dzięki temu mapa podąża za ruchem palców podczas pincza
      const panDeltaX = (pinchStartRef.current.midX - curMidX) * (newW / rect.width);
      const panDeltaY = (pinchStartRef.current.midY - curMidY) * (newH / rect.height);
      newX += panDeltaX;
      newY += panDeltaY;

      // Clamp — nie wychodź poza mapę
      newX = clamp(newX, MAP_BOUNDS.minX, MAP_BOUNDS.maxX - newW);
      newY = clamp(newY, MAP_BOUNDS.minY, MAP_BOUNDS.maxY - newH);

      setViewBox({ x: newX, y: newY, width: newW, height: newH });
      hasDraggedRef.current = true; // zapobiega kliknięciu po pinczu
      return;
    }
    if (e.touches.length !== 1) return;
    e.preventDefault();
    movePan(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length < 2) {
      // Kończ pinch gdy którykolwiek palec zostaje uniesiony
      isPinchingRef.current = false;
      pinchStartRef.current = null;
    }
    if (e.touches.length === 0) {
      endPan();
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      // Jeśli został jeden palec po pinczu — zacznij pan od aktualnej pozycji
      startPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    // Kliknięcie w puste miejsce na mapie (piny i sektory używają e.stopPropagation()):
    // - Jeśli był drag — ignoruj (to był pan, nie klik).
    // - Jeśli jest zoom-in (drawer otwarty) — zamknij drawer i wróć do widoku ogólnego.
    //   Piny i sektory używają e.stopPropagation(), więc ich kliknięcia NIE dochodzą tutaj.
    // Aby wyłączyć zamykanie przez klik poza: zakomentuj clearZoom() poniżej.
    if (hasDraggedRef.current) return;
    if (zoomedSectorId) {
      clearZoom();
    }
  };

  return (
    <section
      className={`map-card ${zoomedSectorId ? "is-zoomed" : ""} ${isAdmin ? "is-admin" : ""}`}
      aria-label="Interaktywna mapa boulderowni Karma"
    >
      <div className="map-pan-container">
        <svg
          ref={svgRef}
          className={`wall-map wall-map-toplogger ${isPanningVisual ? "is-panning" : ""}`}
          viewBox={viewBoxToString(viewBox)}
          role="img"
          aria-labelledby="map-title map-desc"
          onClick={handleSvgClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <title id="map-title">Mapa sektorów i boulderów Karma</title>
          <desc id="map-desc">
            Interaktywna mapa boulderowni Karma z dwunastoma sektorami. Przeciągaj w dowolnym
            kierunku.
          </desc>

          <defs>
            <filter id="pinShadow" x="-45%" y="-45%" width="190%" height="190%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.22" />
            </filter>
            <filter id="dotShadow" x="-80%" y="-80%" width="260%" height="260%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
            </filter>
            <pattern id="topoLines" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M0 60 Q30 40 60 60 T120 60" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
              <path d="M0 30 Q30 10 60 30 T120 30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <path d="M0 90 Q30 70 60 90 T120 90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Tło Karma — ITERACJA 13: karma-bg ma fill:none (patrz index.css .karma-bg).
           * Tło ciemnozielone pochodzi teraz z .map-card CSS (background: var(--karma-teal-dark)).
           * Linie topograficzne (topoLines) nadal są renderowane na tym tle.
           * Aby zmienić wzorzec linii: edytuj <pattern id="topoLines"> powyżej w <defs>. */}
          <rect className="karma-bg" x="-20" y="-20" width={MAP_SIZE.width + 40} height={MAP_SIZE.height + 40} rx="0" />
          <rect x="-20" y="-20" width={MAP_SIZE.width + 40} height={MAP_SIZE.height + 40} rx="0" fill="url(#topoLines)" />

          {/* === WALL CONTENT GROUP — Wszystkie elementy Ŝianki z transformacją === */}
          <g transform={`translate(${WALL_OFFSET.x}, ${WALL_OFFSET.y})`}>
            
            {/* Biały canvas mapy — obejmuje całą mapę (3200×1400) */}
            <rect className="topo-paper-base" x="10" y="10" width={MAP_SIZE.width - 20} height={MAP_SIZE.height - 20} rx="16" />
            
            {/* Background polygons */}
            {backgroundPolygons.map((polygon) => (
              <polygon
                key={polygon.id}
                className="background-polygon"
                points={polygonToPoints(polygon.points)}
                fill={depthToFill(polygon.depth)}
                pointerEvents="none"
              />
            ))}

              {/* Decorative labels */}
  {decorativeLabels.map((label) => (
  <g
    key={label.id}
    transform={`translate(${label.position.x} ${label.position.y}) rotate(${label.rotation ?? 0})`}
  >
    <text
      x={0}
      y={0}
      fontSize={label.fontSize}
      opacity={label.opacity}
      className="decorative-label"
      pointerEvents="none"
    >
      {label.text}
    </text>
  </g>
))}


            {/* Linie materaca */}
            {!activeSectorId &&(
            <g className="mat-line-layer" aria-hidden="true">
              {matLines.map((ml) => (
                <line key={ml.id} className="mat-line" x1={ml.start.x} y1={ml.start.y} x2={ml.end.x} y2={ml.end.y} strokeDasharray={ml.dashed ? "5,5" : "undefined"} />
              ))}
            </g>)}

            {/* Hitboxy sektorów */}
            <g className="sector-hit-layer">
              {sectors.map((sector) => { if (sector.code === "1") {console.log("WallMap polygon:", sector.polygons);}
              
              const active = activeSectorId === sector.id;
              const muted = Boolean(activeSectorId && !active);
              const highlightClass =
                sector.highlight === "new"
                  ? "is-highlight-new"
                  : sector.highlight === "removal"
                  ? "is-highlight-removal"
                  : "";
              return (
                <g
                 
                key={sector.id}
                  className={`sector-hit-zone ${highlightClass} ${active ? "is-active" : ""} ${muted ? "is-muted" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sector.code} - ${sector.name}. Setting ${sector.settingDate}, demontaż ${sector.removalDate}, autor ${sector.author}.`}
                  onClick={(e) => handleSectorClick(e, sector)}
                  onKeyDown={(e) => {
                    if (isActivationKey(e)) {
                      e.preventDefault();
                      activateSector(sector.id);
                    }
                  }}
                >
                 { sector.polygons.map((polygon, index) => (
                    <polygon 
                    key={index} 
                    className="sector-polygon" 
                    points={polygonToPoints(polygon.points)}
                    style={{ fill: depthToFill(polygon.depth), }}
                    />
                  ))}
                </g>
              );
            })}
          </g>

          {/* Linie ścian */}
          <g className="topo-wall-layer" aria-label="Linie ściany">
            {segments.map((segment) => {
              const active = activeSectorId === segment.sectorId;
              const muted = Boolean(activeSectorId && !active);
              const sectorHighlight = sectors.find((s) => s.id === segment.sectorId)?.highlight;
              const highlightClass =
                sectorHighlight === "new"
                  ? "is-highlight-new"
                  : sectorHighlight === "removal"
                  ? "is-highlight-removal"
                  : "";
              const importance = getSegmentImportance(segment.name);
              const style = importanceToStyle(importance);
              const keepVisible = 
              segment.name.toLowerCase().includes("main");
              segment.name.toLowerCase().includes("pdst.");
              segment.name.toLowerCase().includes("exception");
              return (
                <g
                  key={segment.id}
                  
                  className={`
                    topo-segment 
                    ${highlightClass} 
                    ${active ? "is-active" : ""} 
                    ${muted ? "is-muted" : ""}
                    ${keepVisible ? "keep-visible" : ""}
                    `}

                  role="button"
                  tabIndex={0}
                  aria-label={`${segment.name}. Kliknij, aby otworzyć sektor.`}
                  onClick={(e) => handleSegmentClick(e, segment)}
                  onKeyDown={(e) => {
                    if (isActivationKey(e)) {
                      e.preventDefault();
                      activateSector(segment.sectorId);
                    }
                  }}
                >
                  
                  <
                    line className="topo-line-halo" 
                   x1={segment.start.x} 
                   y1={segment.start.y} 
                   x2={segment.end.x} 
                   y2={segment.end.y} 
                  />
                  
                  <
                    line className="topo-line" 
                   x1={segment.start.x} 
                   y1={segment.start.y} 
                   x2={segment.end.x} 
                   y2={segment.end.y} 
                  
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeOpacity={style.opacity}
                  strokeDasharray={style.dasharray}
                  />
                  
                  <circle className="topo-joint" cx={segment.start.x} cy={segment.start.y} r="0" />
                  <circle className="topo-joint" cx={segment.end.x} cy={segment.end.y} r="0" />
                </g>
              );
            })}
          </g>

          {/* Etykiety sektorów */}
          <g className="sector-label-layer" aria-hidden="true">
            {sectors.map((sector) => {
              const lines = getSectorLabelLines(sector);
              const active = activeSectorId === sector.id;
              const muted = Boolean(activeSectorId && !active);
              const highlightClass =
                sector.highlight === "new"
                  ? "is-highlight-new"
                  : sector.highlight === "removal"
                  ? "is-highlight-removal"
                  : "";
              return (
                <g key={sector.id} className={`map-sector-label ${highlightClass} ${active ? "is-active" : ""} ${muted ? "is-muted" : ""}`}>
                  <text x={sector.label.x} y={sector.label.y} textAnchor="middle">
                    {lines.map((line, i) => (
                      <tspan key={line} x={sector.label.x} dy={i === 0 ? 0 : 24}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>

            {/* Piny boulderów */}
            <g className="pin-layer">
            {visibleBoulders.map((boulder, index) => {
              const gradeColor = getGradeColor(boulder.grade);
              const holdColor = getHoldColor(boulder.holdColor);
              const zoomed = Boolean(zoomedSectorId);
              const active = zoomed &&selection?.type === "boulder" && selection.id === boulder.id;
              const muted = Boolean(zoomedSectorId && zoomedSectorId !== boulder.sectorId);
          
              return (
                <g
                  key={boulder.id}
                  className={`boulder-pin ${zoomed ? "pin-zoomed" : "pin-dot"} ${active ? "is-active" : ""} ${muted ? "is-muted" : ""}`}
                  transform={`translate(${boulder.position.x} ${boulder.position.y})`}
                  role={zoomed?"button":undefined}
                  tabIndex={zoomed? 0:undefined}
                  aria-label={`${index + 1}. Boulder, trudność ${boulder.grade}, chwyty ${holdColor.label}, autor ${boulder.author}.`}
                  onClick={zoomed?(e) => {
                    if (hasDraggedRef.current) return;
                    e.stopPropagation();
                    // Zawsze ustawiamy zoom na sektor bouldera i informujemy App.
                    // Dzięki temu drawer zawsze się otworzy — nawet jeśli App zamknął
                    // drawer wcześniej (App.zoomedSectorId=null) ale WallMap nadal
                    // ma wewnętrzny zoom na ten sektor.
                    setZoomedSectorId(boulder.sectorId);
                    onZoomSectorChange?.(boulder.sectorId);
                    onSelectBoulder(boulder.id);
                  }:undefined}
                  onKeyDown={zoomed?(e) => {
                    if (isActivationKey(e)) {
                      e.preventDefault();
                      setZoomedSectorId(boulder.sectorId);
                      onZoomSectorChange?.(boulder.sectorId);
                      onSelectBoulder(boulder.id);
                    }
                  }:undefined}
                >
                  {zoomed ? (
                    <>
                      <circle className="pin-hit" r="30" />
                      <circle className="pin-outer" r="20" />
                      <circle className="pin-core" r="20" fill={gradeColor.hex} />
                      <text className="pin-grade" y="5" textAnchor="middle" fill={gradeColor.text}>
                        {boulder.grade}
                      </text>
                    </>
                  ) : (
                    <>
                   
                      <circle className="pin-dot-core" r="16" fill={gradeColor.hex} />
                    </>
                  )}
                </g>
              );
            })}
            </g>
          </g>
          {/* === END WALL_OFFSET TRANSFORM GROUP === */}
        </svg>
      </div>
    </section>
  );
}
