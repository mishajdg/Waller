/**
 * Design reminder — Swiss Utility Cartography:
 * model danych ma wzmacniać mapową precyzję: sektor jest kontenerem,
 * segment opisuje geometrię ściany, a pin bouldera jest obiektem topo.
 * Iteracja 7 dodaje stan podświetlenia sektora, zachowując skalę trudności 1–10
 * i ograniczoną listę kolorów chwytów używaną przez formularz admina.
 */
export type Point = {
  x: number;
  y: number;
};

export type PolygonData = {
  points: Point[];
  depth: number;
  id: string;
};

export type HoldColorKey =
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "orange"
  | "purple"
  | "black"
  | "white"
  | "lightBlue"
  | "gray"
  | "pink";

export type BoulderGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SectorHighlight = "new" | "removal";

export type GradeColorDefinition = {
  label: string;
  hex: string;
  text: string;
};

export type SectorPolygon = {
  points: Point[];
  depth: number;
};

export type Sector = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  polygons: SectorPolygon[];
  label: Point;
  fill: string;
  settingDate: string;
  removalDate: string;
  author: string;
  description: string;
  cameraOffset?: Point;
  zoomScale?: number;
  highlight?: SectorHighlight | null;
};

export type WallSegment = {
  id: string;
  sectorId: string;
  name: string;
  start: Point;
  end: Point;
  angleLabel: string;
};

export type BoulderPin = {
  id: string;
  name: string;
  sectorId: string;
  segmentId: string;
  position: Point;
  grade: BoulderGrade;
  holdColor: HoldColorKey;
  author: string;
};

export type Selection =
  | { type: "sector"; id: string }
  | { type: "boulder"; id: string }
  | null;

export type SnapCandidate = {
  segment: WallSegment;
  point: Point;
  distance: number;
  accepted: boolean;
  threshold: number;
};
