/**
 * Design reminder — Swiss Utility Cartography:
 * layout pinów ma być deterministyczny i czytelny w QR. W każdym sektorze bouldery
 * układamy od najłatwiejszego do najtrudniejszego po czytelnym kierunku linii:
 * od lewej do prawej, a przy pionowych fragmentach od góry do dołu.
 */
import type { BoulderPin, BoulderGrade, Point, WallSegment } from "../types";
import { MAP_SIZE } from "../data/gymMap";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const segmentLength = (segment: WallSegment) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) || 1;

const getReadableEndpoints = (segment: WallSegment) => {
  if (segment.start.x < segment.end.x) return { start: segment.start, end: segment.end };
  if (segment.start.x > segment.end.x) return { start: segment.end, end: segment.start };
  return segment.start.y <= segment.end.y
    ? { start: segment.start, end: segment.end }
    : { start: segment.end, end: segment.start };
};

const getOrderedSectorSegments = (sectorId: string, segments: WallSegment[]) =>
  segments
    .filter((segment) => segment.sectorId === sectorId)
    .sort((a, b) => {
      const minAx = Math.min(a.start.x, a.end.x);
      const minBx = Math.min(b.start.x, b.end.x);
      if (minAx !== minBx) return minAx - minBx;

      const minAy = Math.min(a.start.y, a.end.y);
      const minBy = Math.min(b.start.y, b.end.y);
      return minAy - minBy;
    });

const pointOnReadableSegment = (segment: WallSegment, t: number): Point => {
  const endpoints = getReadableEndpoints(segment);
  return {
    x: endpoints.start.x + (endpoints.end.x - endpoints.start.x) * t,
    y: endpoints.start.y + (endpoints.end.y - endpoints.start.y) * t,
  };
};

export const sortBouldersByDifficulty = (boulders: BoulderPin[]) =>
  [...boulders].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    const nameCompare = a.name.localeCompare(b.name, "pl");
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });

export const getBouldersForSectorSorted = (boulders: BoulderPin[], sectorId: string) =>
  sortBouldersByDifficulty(boulders.filter((boulder) => boulder.sectorId === sectorId));

export const layoutBouldersByDifficulty = (boulders: BoulderPin[], segments: WallSegment[]) => {
  const originalOrder = new Map(boulders.map((boulder, index) => [boulder.id, index]));
  const grouped = new Map<string, BoulderPin[]>();

  boulders.forEach((boulder) => {
    const group = grouped.get(boulder.sectorId) ?? [];
    group.push(boulder);
    grouped.set(boulder.sectorId, group);
  });

  const positioned: BoulderPin[] = [];

  grouped.forEach((sectorBoulders, sectorId) => {
    const allSegments = getOrderedSectorSegments(sectorId, segments);
    const sectorSegments = allSegments.filter(
      segment => 
        segment.id.includes("main"));
    const sorted = sortBouldersByDifficulty(sectorBoulders);

    if (sectorSegments.length === 0) {
      positioned.push(...sorted);
      return;
    }

    const lengths = sectorSegments.map(segmentLength);
    const totalLength = lengths.reduce((sum, length) => sum + length, 0) || 1;

    sorted.forEach((boulder, index) => {
      const targetDistance = totalLength * ((index + 1) / (sorted.length + 1));
      let consumed = 0;
      let targetSegment = sectorSegments[0];
      let localT = 0.5;

      for (let segmentIndex = 0; segmentIndex < sectorSegments.length; segmentIndex += 1) {
        const length = lengths[segmentIndex] || 1;
        if (targetDistance <= consumed + length || segmentIndex === sectorSegments.length - 1) {
          targetSegment = sectorSegments[segmentIndex];
          localT = clamp((targetDistance - consumed) / length, 0.08, 0.92);
          break;
        }
        consumed += length;
      }

      const point = pointOnReadableSegment(targetSegment, localT);
      positioned.push({
        ...boulder,
        segmentId: targetSegment.id,
        position: {
          x: clamp(point.x, 8, MAP_SIZE.width - 8),
          y: clamp(point.y, 8, MAP_SIZE.height - 8),
        },
      });
    });
  });

  return positioned.sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));
};

export const isValidBoulderGrade = (value: number): value is BoulderGrade =>
  Number.isInteger(value) && value >= 1 && value <= 10;
