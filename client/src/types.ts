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

export type SectorHighlightMode =
| "text"
| "background"
| "text-background";

export type SectorHighlightUnderline =
| "none"
| "solid"
| "dashed";

export type SectorHighlightStyle = {
  color: string;
  mode: SectorHighlightMode;
  underline: SectorHighlightUnderline;
};

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

/**
 * ============================================================
 * MODUŁ REZERWACJI — sekcje wspinaczkowe (booking, Booksy-style)
 * Patrz supabase/003_class_sections.sql dla dokładnego schematu.
 * ============================================================
 */
export type SectionKind = "recurring" | "dropin" | "individual";
export type OccurrenceStatus = "scheduled" | "cancelled";
export type BookingStatus = "confirmed" | "waitlisted" | "cancelled";

/** Instruktor — patrz supabase/004_instructors.sql. Encja, nie wolny tekst. */
export type Instructor = {
  id: string;
  gymId: string;
  name: string;
  bio: string;
  isActive: boolean;
};

export type ClassSection = {
  id: string;
  gymId: string;
  name: string;
  description: string;
  kind: SectionKind;
  instructorId: string | null;
  defaultCapacity: number;
  priceInfo: string;
  isActive: boolean;
};

export type ClassOccurrence = {
  id: string;
  sectionId: string;
  startsAt: string; // ISO datetime
  endsAt: string; // ISO datetime
  capacity: number;
  confirmedCount: number;
  waitlistedCount: number;
  status: OccurrenceStatus;
};

export type Booking = {
  id: string;
  occurrenceId: string;
  clientUserId: string;
  clientName: string;
  clientPhone: string;
  status: BookingStatus;
  createdAt: string;
};

/** Widok złożony dla UI: termin + policzone miejsca + własna rezerwacja klienta (jeśli jest) */
export type OccurrenceWithAvailability = ClassOccurrence & {
  spotsLeft: number;
  myBooking: Booking | null;
};

/** Sekcja razem z jej nadchodzącymi terminami — jednostka renderowana w widoku grafiku.
 *  instructorName jest doliczane przez useClassSchedule (join po stronie klienta z
 *  instructors) — wygodne do wyświetlenia, nie jest to kolumna w bazie. */
export type SectionSchedule = {
  section: ClassSection & { instructorName: string | null };
  occurrences: OccurrenceWithAvailability[];
};

/** Zagregowane statystyki admina — patrz useAdminStats. Liczone z class_occurrences
 *  (publicznie czytelne liczniki), bez dotykania bookings. */
export type SectionStats = {
  sectionId: string;
  sectionName: string;
  occurrenceCount: number;
  totalConfirmed: number;
  totalCapacity: number;
  occupancyRate: number; // 0..1, 0 gdy totalCapacity===0
};

export type AdminStats = {
  totalSections: number;
  totalInstructors: number;
  upcomingOccurrenceCount: number;
  pastOccurrenceCount: number;
  totalConfirmedBookings: number;
  totalWaitlisted: number;
  bySection: SectionStats[];
};
