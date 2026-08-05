/**
 * Design reminder — Swiss Utility Cartography:
 * geometria powinna być jawna, przewidywalna i możliwa do rozwinięcia
 * w edytor routesettera bez zmiany publicznego widoku mapy.
 */
import type { Point, Sector, SnapCandidate, WallSegment } from "../types";

export const polygonToPoints = (points: Point[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const projectPointToSegment = (point: Point, segment: WallSegment): Point => {
  const ax = segment.start.x;
  const ay = segment.start.y;
  const bx = segment.end.x;
  const by = segment.end.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return { ...segment.start };

  const rawT = ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));

  return {
    x: ax + t * dx,
    y: ay + t * dy,
  };
};

export const snapPointToSegments = (
  point: Point,
  segments: WallSegment[],
  options: { zoom?: number; baseThreshold?: number } = {},
): SnapCandidate | null => {
  const zoom = options.zoom ?? 1;
  const baseThreshold = options.baseThreshold ?? 34;
  const threshold = Math.max(14, baseThreshold / Math.max(zoom, 0.65));

  const candidates = segments.map((segment) => {
    const projected = projectPointToSegment(point, segment);
    return {
      segment,
      point: projected,
      distance: distance(point, projected),
      accepted: false,
      threshold,
    } satisfies SnapCandidate;
  });

  const closest = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!closest) return null;

  return {
    ...closest,
    accepted: closest.distance <= threshold,
  };
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

export const getSectorAtPoint = (point: Point, sectors: Sector[]) =>
  sectors.find((sector) => sector.polygons.some((polygon) =>
    pointInPolygon(point, polygon.points ))) ?? null;

export const getSegmentsForSector = (sectorId: string, segments: WallSegment[]) =>
  segments.filter((segment) => segment.sectorId === sectorId);
