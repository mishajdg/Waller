/**
 * SectorLabel — nazwa sektora + pigułka „nowe"/„stare" + licznik ⬡ × N (widok ogólny).
 * Rozmiar i położenie pigułki/licznika ustawiasz w data/labelBadges.ts (nie tutaj).
 * Geometria liczona jest z REALNEJ szerokości napisu (getBBox), więc „z lewej / z prawej"
 * działa poprawnie dla każdej nazwy i czcionki.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Sector } from "../types";
import { hexPoints } from "../lib/geometry";
import {
  COUNTER_DEFAULT,
  COUNTER_OVERRIDES,
  COUNTER_TIMES,
  PILL_DEFAULT,
  PILL_OVERRIDES,
  SECTOR_PILLS,
  type BadgeStyle,
} from "../data/labelBadges";

type Metrics = { x: number; w: number; fs: number }; // lewa krawędź, szerokość i rozmiar czcionki napisu

function useTextMetrics(ref: RefObject<SVGTextElement | null>, deps: unknown[]) {
  const [m, setM] = useState<Metrics | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      try {
        const b = el.getBBox();
        const fs = parseFloat(getComputedStyle(el).fontSize) || 23;
        setM((p) => (p && p.x === b.x && p.w === b.width && p.fs === fs ? p : { x: b.x, w: b.width, fs }));
      } catch {
        /* napis jeszcze niewidoczny */
      }
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return m;
}

const norm = (s: string) => s.trim().toLowerCase();

// Wyjątek dla sektora: szukany po kodzie ("3"), nazwie ("Lewy compwall") albo id (UUID); wielkość liter bez znaczenia
function overrideFor<T>(map: Record<string, T>, sector: Sector): T | undefined {
  const keys = [sector.code, sector.name, sector.id].map(norm);
  const hit = Object.keys(map).find((k) => keys.includes(norm(k)));
  return hit === undefined ? undefined : map[hit];
}

// Klucze z labelBadges.ts, które nie pasują do żadnego sektora (pokazuje je tryb ?debug=1)
export function badgeOverrideProblems(sectors: Sector[]): string[] {
  const known = new Set(sectors.flatMap((s) => [s.code, s.name, s.id].map(norm)));
  const out: string[] = [];
  const check = (name: string, map: Record<string, unknown>) =>
    Object.keys(map).forEach((k) => {
      if (!known.has(norm(k))) out.push(`${name}: klucz "${k}" nie pasuje do żadnego sektora`);
    });
  check("PILL_OVERRIDES", PILL_OVERRIDES);
  check("COUNTER_OVERRIDES", COUNTER_OVERRIDES);
  return out;
}

// Środek plakietki (cx, cy) względem nazwy sektora, wg ustawień z labelBadges.ts
function place(s: BadgeStyle, m: Metrics, firstBase: number, lastBase: number, w: number, h: number) {
  const gap = s.gap * m.fs;
  const pl = s.placement === "up" ? "above" : s.placement === "down" ? "below" : s.placement;
  let cx = m.x + m.w / 2;
  let cy = (firstBase + lastBase) / 2 - 0.3 * m.fs; // optyczny środek napisu
  if (pl === "below") cy = lastBase + 0.25 * m.fs + gap + h / 2;
  if (pl === "above") cy = firstBase - 0.7 * m.fs - gap - h / 2;
  if (pl === "right") cx = m.x + m.w + gap + w / 2;
  if (pl === "left") cx = m.x - gap - w / 2;
  if (s.x !== undefined) cx = s.x; // położenie bezwzględne (jednostki mapy) nadpisuje placement
  if (s.y !== undefined) cy = s.y;
  return { cx: cx + s.dx * m.fs, cy: cy + s.dy * m.fs };
}


type Props = {
  sector: Sector;
  lines: string[];
  active: boolean;
  muted: boolean;
  count: number | null; // liczba boulderów w sektorze (null = bez licznika, np. po zoomie w sektor)
};

export function SectorLabel({ sector, lines, active, muted, count }: Props) {
  const textRef = useRef<SVGTextElement>(null);
  const m = useTextMetrics(textRef, [sector.name, lines.length, active]);
  const { x, y } = sector.label;
  const lastBase = y + (lines.length - 1) * 24;
  const mutedClass = muted ? "is-muted" : "";
  const highlightClass =
    sector.highlight === "new" ? "is-highlight-new" : sector.highlight === "removal" ? "is-highlight-removal" : "";

  // pigułka „nowe" / „stare"
  const pill = sector.highlight ? SECTOR_PILLS[sector.highlight] : null;
  const ps: BadgeStyle = { ...PILL_DEFAULT, ...overrideFor(PILL_OVERRIDES, sector) };
  const pk = m ? m.fs * ps.scale : 0;
  const pw = pill ? pill.width * pk : 0;
  const ph = 1.45 * pk;
  const pp = m && pill ? place(ps, m, y, lastBase, pw, ph) : null;

  // licznik ⬡ × N
   const cs: BadgeStyle = { ...COUNTER_DEFAULT, ...overrideFor(COUNTER_OVERRIDES, sector) };
  const ck = m ? m.fs * cs.scale : 0;
  const hexR = 0.58 * ck;
  const hexW = 2 * hexR;
  const gapT = 0.32 * ck;
  const cw = hexW + gapT + (0.85 + 0.6 * String(count ?? 0).length) * ck;
  const cp = m && count !== null ? place(cs, m, y, lastBase, cw, Math.sqrt(3) * hexR) : null;

  return (
    <g>
      <g className={`map-sector-label ${highlightClass} ${active ? "is-active" : ""} ${mutedClass}`}>
        <text ref={textRef} x={x} y={y} textAnchor="middle">
          {lines.map((line, i) => (
            <tspan key={line} x={x} dy={i === 0 ? 0 : 24}>
              {line}
            </tspan>
          ))}
        </text>
      </g>

      {pill && pp && (
        <g className={`sector-pill is-${sector.highlight} ${mutedClass}`}>
          <rect x={pp.cx - pw / 2} y={pp.cy - ph / 2} width={pw} height={ph} rx={ph / 2} strokeWidth={0.09 * pk} />
          <text x={pp.cx} y={pp.cy + 0.265 * pk} fontSize={pk} textAnchor="middle">
            {pill.text}
          </text>
        </g>
      )}

      {cp && (
        <g className={`sector-counter ${mutedClass}`}>
          <polygon
            transform={`translate(${cp.cx - cw / 2 + hexR} ${cp.cy})`}
            points={hexPoints(hexR)}
            strokeWidth={0.1 * ck}
          />
          <text x={cp.cx - cw / 2 + hexW + gapT} y={cp.cy + 0.35 * ck} fontSize={ck}>
            {`${COUNTER_TIMES} ${count}`}
          </text>
        </g>
      )}
    </g>
  );
}
