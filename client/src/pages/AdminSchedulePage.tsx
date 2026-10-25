/**
 * AdminSchedulePage — panel admina modułu rezerwacji (sekcje/terminy/instruktorzy/statystyki)
 * ================================================================================================
 * Gate: isAdmin z AuthContext — ta sama sesja co bramka /admin na mapie, osobne logowanie
 * nie jest potrzebne. Stylistycznie i wzorcami (.admin-form, .admin-field-grid,
 * .admin-inline-confirm z ✔/✖, .admin-boulder-row) świadomie kopiuje drawer admina z
 * MapPage.tsx zamiast wprowadzać nowy język wizualny — jedyny nowy element to <Tabs>
 * (shadcn), bo odpowiednika zakładek w aplikacji wcześniej nie było.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { LoginForm } from "../components/LoginForm";
import { useInstructors } from "../hooks/useInstructors";
import { useInstructorActions } from "../hooks/useInstructorActions";
import { useClassSectionActions, type ClassSectionDraft } from "../hooks/useClassSectionActions";
import { useClassOccurrenceActions } from "../hooks/useClassOccurrenceActions";
import { useAdminStats } from "../hooks/useAdminStats";
import { mapOccurrenceRow, mapSectionRow } from "../hooks/useClassSchedule";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import type { ClassOccurrence, ClassSection, Instructor, SectionKind } from "../types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

import "./AdminSchedulePage.css";

const KIND_OPTIONS: Array<{ value: SectionKind; label: string }> = [
  { value: "recurring", label: "Grupa cykliczna" },
  { value: "dropin", label: "Dropin" },
  { value: "individual", label: "Trening indywidualny" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KIND_OPTIONS.map((o) => [o.value, o.label]));

const EMPTY_SECTION_DRAFT: ClassSectionDraft = {
  name: "",
  description: "",
  kind: "recurring",
  instructorId: null,
  defaultCapacity: 8,
  priceInfo: "",
  isActive: true,
};

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminSchedulePage() {
  const { isAdmin, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <main className="app-shell" aria-label="Ładowanie">
        <div className="admin-schedule-loading">
          <p className="eyebrow">Karma</p>
          <p>Ładowanie...</p>
        </div>
      </main>
    );
  }

  // Ten sam LoginForm co bramka mapy — jedna sesja admina na całą aplikację.
  if (!isAdmin) {
    return <LoginForm variant="admin" />;
  }

  return <AdminSchedulePanel />;
}

function AdminSchedulePanel() {
  const { signOut } = useAuth();

  const { instructors, refetch: refetchInstructors } = useInstructors();
  const { addInstructor, updateInstructor, deleteInstructor } = useInstructorActions();
  const { addSection, updateSection, setSectionActive } = useClassSectionActions();
  const { addOccurrence, generateWeeklyOccurrences, cancelOccurrence } = useClassOccurrenceActions();
  const { stats, isLoading: isStatsLoading, error: statsError } = useAdminStats();

  // Własny fetch (nie useClassSchedule) — admin musi widzieć TEŻ nieaktywne sekcje,
  // useClassSchedule celowo filtruje is_active=true dla publicznego widoku.
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [occurrences, setOccurrences] = useState<ClassOccurrence[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const fetchAdminSchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    setScheduleError(null);
    if (!isSupabaseConfigured || !supabase) {
      setScheduleError("Supabase nie jest skonfigurowany.");
      setIsLoadingSchedule(false);
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const [sectionsRes, occurrencesRes] = await Promise.all([
        supabase.from("class_sections").select("*").eq("gym_id", WALLER_GYM_ID).order("sort_order", { ascending: true }),
        supabase
          .from("class_occurrences")
          .select("*")
          .eq("gym_id", WALLER_GYM_ID)
          .eq("status", "scheduled")
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true }),
      ]);
      if (sectionsRes.error) throw sectionsRes.error;
      if (occurrencesRes.error) throw occurrencesRes.error;
      setSections((sectionsRes.data || []).map(mapSectionRow));
      setOccurrences((occurrencesRes.data || []).map(mapOccurrenceRow));
    } catch (err: any) {
      setScheduleError(err.message || "Błąd ładowania grafiku.");
    } finally {
      setIsLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminSchedule();
  }, [fetchAdminSchedule]);

  const instructorNameById = useMemo(() => new Map(instructors.map((i) => [i.id, i.name])), [instructors]);
  const sectionNameById = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);

  // ===== Sekcje =====
  const [sectionDraft, setSectionDraft] = useState<ClassSectionDraft>(EMPTY_SECTION_DRAFT);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);

  const startEditSection = (section: ClassSection) => {
    setEditingSectionId(section.id);
    setSectionDraft({
      name: section.name,
      description: section.description,
      kind: section.kind,
      instructorId: section.instructorId,
      defaultCapacity: section.defaultCapacity,
      priceInfo: section.priceInfo,
      isActive: section.isActive,
    });
    setSectionFormError(null);
  };

  const cancelEditSection = () => {
    setEditingSectionId(null);
    setSectionDraft(EMPTY_SECTION_DRAFT);
    setSectionFormError(null);
  };

  const handleSectionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSectionFormError(null);
    if (!sectionDraft.name.trim()) {
      setSectionFormError("Podaj nazwę sekcji.");
      return;
    }
    if (!Number.isFinite(sectionDraft.defaultCapacity) || sectionDraft.defaultCapacity < 1) {
      setSectionFormError("Domyślna pojemność musi być liczbą większą od 0.");
      return;
    }
    setIsSavingSection(true);
    try {
      if (editingSectionId) {
        await updateSection(editingSectionId, sectionDraft);
      } else {
        await addSection(sectionDraft);
      }
      cancelEditSection();
      await fetchAdminSchedule();
    } catch (err: any) {
      setSectionFormError(err.message || "Błąd zapisu sekcji.");
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleToggleSectionActive = async (section: ClassSection) => {
    setSectionFormError(null);
    try {
      await setSectionActive(section.id, !section.isActive);
      await fetchAdminSchedule();
    } catch (err: any) {
      setSectionFormError(err.message || "Błąd zmiany statusu sekcji.");
    }
  };

  // ===== Instruktorzy =====
  const [instructorDraft, setInstructorDraft] = useState({ name: "", bio: "" });
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [instructorFormError, setInstructorFormError] = useState<string | null>(null);
  const [isSavingInstructor, setIsSavingInstructor] = useState(false);
  const [deleteInstructorConfirmId, setDeleteInstructorConfirmId] = useState<string | null>(null);

  const startEditInstructor = (instructor: Instructor) => {
    setEditingInstructorId(instructor.id);
    setInstructorDraft({ name: instructor.name, bio: instructor.bio });
    setInstructorFormError(null);
  };

  const cancelEditInstructor = () => {
    setEditingInstructorId(null);
    setInstructorDraft({ name: "", bio: "" });
    setInstructorFormError(null);
  };

  const handleInstructorSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInstructorFormError(null);
    if (!instructorDraft.name.trim()) {
      setInstructorFormError("Podaj imię i nazwisko instruktora.");
      return;
    }
    setIsSavingInstructor(true);
    try {
      if (editingInstructorId) {
        await updateInstructor(editingInstructorId, instructorDraft);
      } else {
        await addInstructor(instructorDraft.name, instructorDraft.bio);
      }
      cancelEditInstructor();
      await refetchInstructors();
    } catch (err: any) {
      setInstructorFormError(err.message || "Błąd zapisu instruktora.");
    } finally {
      setIsSavingInstructor(false);
    }
  };

  const handleDeleteInstructor = async (instructorId: string) => {
    setInstructorFormError(null);
    try {
      await deleteInstructor(instructorId);
      setDeleteInstructorConfirmId(null);
      await refetchInstructors();
      await fetchAdminSchedule(); // sekcje mogły stracić przypisanie (ON DELETE SET NULL)
    } catch (err: any) {
      setInstructorFormError(err.message || "Błąd usuwania instruktora.");
    }
  };

  // ===== Terminy =====
  const [occurrenceSectionId, setOccurrenceSectionId] = useState("");
  const [occurrenceMode, setOccurrenceMode] = useState<"single" | "weekly">("single");
  const [occurrenceStartsAt, setOccurrenceStartsAt] = useState("");
  const [occurrenceDuration, setOccurrenceDuration] = useState(60);
  const [occurrenceCapacity, setOccurrenceCapacity] = useState(8);
  const [occurrenceWeeks, setOccurrenceWeeks] = useState(8);
  const [occurrenceFormError, setOccurrenceFormError] = useState<string | null>(null);
  const [isSavingOccurrence, setIsSavingOccurrence] = useState(false);
  const [cancellingOccurrenceId, setCancellingOccurrenceId] = useState<string | null>(null);

  const handleOccurrenceSectionChange = (sectionId: string) => {
    setOccurrenceSectionId(sectionId);
    const section = sections.find((s) => s.id === sectionId);
    if (section) setOccurrenceCapacity(section.defaultCapacity);
  };

  const handleOccurrenceSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setOccurrenceFormError(null);
    if (!occurrenceSectionId) {
      setOccurrenceFormError("Wybierz sekcję.");
      return;
    }
    if (!occurrenceStartsAt) {
      setOccurrenceFormError("Podaj datę i godzinę pierwszego terminu.");
      return;
    }
    if (occurrenceDuration < 1) {
      setOccurrenceFormError("Czas trwania musi być większy od 0.");
      return;
    }
    if (occurrenceCapacity < 1) {
      setOccurrenceFormError("Pojemność musi być większa od 0.");
      return;
    }
    if (occurrenceMode === "weekly" && (occurrenceWeeks < 1 || occurrenceWeeks > 52)) {
      setOccurrenceFormError("Liczba tygodni musi być między 1 a 52.");
      return;
    }

    setIsSavingOccurrence(true);
    try {
      if (occurrenceMode === "single") {
        await addOccurrence({
          sectionId: occurrenceSectionId,
          startsAt: occurrenceStartsAt,
          durationMinutes: occurrenceDuration,
          capacity: occurrenceCapacity,
        });
      } else {
        await generateWeeklyOccurrences({
          sectionId: occurrenceSectionId,
          firstStartsAt: occurrenceStartsAt,
          durationMinutes: occurrenceDuration,
          capacity: occurrenceCapacity,
          weeksCount: occurrenceWeeks,
        });
      }
      setOccurrenceStartsAt("");
      await fetchAdminSchedule();
    } catch (err: any) {
      setOccurrenceFormError(err.message || "Błąd zapisu terminu.");
    } finally {
      setIsSavingOccurrence(false);
    }
  };

  const handleCancelOccurrence = async (occurrenceId: string) => {
    setOccurrenceFormError(null);
    try {
      await cancelOccurrence(occurrenceId);
      setCancellingOccurrenceId(null);
      await fetchAdminSchedule();
    } catch (err: any) {
      setOccurrenceFormError(err.message || "Błąd anulowania terminu.");
    }
  };

  return (
    <main className="app-shell">
      <header className="app-kiosk-header">
        <div className="karma-header-brand">
          <img src="/logo-karma.png" alt="Logo Karma Climbing" className="karma-logo-img" aria-label="Logo Karma" />
          <span className="karma-header-name">KARMA</span>
        </div>
        <div className="header-mode-btn-wrap">
          <Link href="/" className="mode-pill">
            ← Mapa
          </Link>
          <Link href="/zajecia" className="mode-pill">
            Podgląd grafiku
          </Link>
          <button className="mode-pill mode-pill--admin" type="button" onClick={() => signOut()}>
            Wyloguj
          </button>
        </div>
      </header>

      <section className="schedule-intro" aria-label="Panel admina — moduł rezerwacji">
        <p className="eyebrow">Panel admina</p>
        <h1>Sekcje i rezerwacje</h1>
      </section>

      {scheduleError && <p className="schedule-error">{scheduleError}</p>}

      <Tabs defaultValue="sections" className="admin-schedule-tabs">
        <TabsList>
          <TabsTrigger value="sections">Sekcje</TabsTrigger>
          <TabsTrigger value="occurrences">Terminy</TabsTrigger>
          <TabsTrigger value="instructors">Instruktorzy</TabsTrigger>
          <TabsTrigger value="stats">Statystyki</TabsTrigger>
        </TabsList>

        {/* ================= SEKCJE ================= */}
        <TabsContent value="sections" className="admin-schedule-tabcontent">
          <section className="admin-sector-panel" aria-label="Formularz sekcji">
            <div>
              <span className="admin-section-label">{editingSectionId ? "Edytuj sekcję" : "Nowa sekcja"}</span>
            </div>
            <form className="admin-field-grid" onSubmit={handleSectionSubmit}>
              <label>
                <span>Nazwa</span>
                <input
                  type="text"
                  value={sectionDraft.name}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="np. Grupa młodzieżowa wtorek"
                />
              </label>
              <label>
                <span>Opis</span>
                <input
                  type="text"
                  value={sectionDraft.description}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Krótki opis widoczny dla klienta"
                />
              </label>
              <label>
                <span>Rodzaj</span>
                <select
                  value={sectionDraft.kind}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, kind: e.target.value as SectionKind }))}
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Instruktor</span>
                <select
                  value={sectionDraft.instructorId ?? "none"}
                  onChange={(e) =>
                    setSectionDraft((d) => ({ ...d, instructorId: e.target.value === "none" ? null : e.target.value }))
                  }
                >
                  <option value="none">— brak —</option>
                  {instructors
                    .filter((i) => i.isActive || i.id === sectionDraft.instructorId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Domyślna pojemność</span>
                <input
                  type="number"
                  min="1"
                  value={sectionDraft.defaultCapacity}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, defaultCapacity: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Cena (informacyjnie)</span>
                <input
                  type="text"
                  value={sectionDraft.priceInfo}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, priceInfo: e.target.value }))}
                  placeholder="np. 50 zł / zajęcia"
                />
              </label>
              <label>
                <span>Aktywna (widoczna w grafiku)</span>
                <Switch
                  checked={sectionDraft.isActive}
                  onCheckedChange={(checked) => setSectionDraft((d) => ({ ...d, isActive: checked }))}
                />
              </label>

              {sectionFormError && <p className="admin-form-error">{sectionFormError}</p>}

              <div className="admin-dialog-confirm-row">
                {editingSectionId && (
                  <button className="admin-panel-button" type="button" onClick={cancelEditSection}>
                    Anuluj edycję
                  </button>
                )}
                <button className="admin-panel-button admin-save-button" type="submit" disabled={isSavingSection}>
                  {isSavingSection ? "Zapisywanie..." : editingSectionId ? "Zapisz zmiany" : "Dodaj sekcję"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-panel-section" aria-label="Lista sekcji">
            <span className="admin-section-label">Istniejące sekcje ({sections.length})</span>
            {isLoadingSchedule ? (
              <p className="admin-empty-note">Ładowanie...</p>
            ) : sections.length === 0 ? (
              <p className="admin-empty-note">Brak sekcji — dodaj pierwszą powyżej.</p>
            ) : (
              <div className="admin-boulder-list">
                {sections.map((section) => (
                  <div className={`admin-boulder-row${!section.isActive ? " admin-boulder-pending-delete" : ""}`} key={section.id}>
                    <button className="admin-boulder-identity" type="button" onClick={() => startEditSection(section)}>
                      <span className="admin-boulder-dot">{KIND_LABEL[section.kind]?.charAt(0) ?? "?"}</span>
                      <span>
                        {section.name}
                        {" — "}
                        {KIND_LABEL[section.kind] ?? section.kind}
                        {", "}
                        {instructorNameById.get(section.instructorId ?? "") ?? "brak instruktora"}
                      </span>
                    </button>
                    <button className="admin-panel-button" type="button" onClick={() => handleToggleSectionActive(section)}>
                      {section.isActive ? "Dezaktywuj" : "Aktywuj"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ================= TERMINY ================= */}
        <TabsContent value="occurrences" className="admin-schedule-tabcontent">
          <section className="admin-sector-panel" aria-label="Formularz terminu">
            <div>
              <span className="admin-section-label">Nowy termin</span>
            </div>
            <form className="admin-field-grid" onSubmit={handleOccurrenceSubmit}>
              <label>
                <span>Sekcja</span>
                <select value={occurrenceSectionId} onChange={(e) => handleOccurrenceSectionChange(e.target.value)}>
                  <option value="">— wybierz sekcję —</option>
                  {sections
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="admin-highlight-actions" role="radiogroup" aria-label="Tryb dodawania">
                <button
                  type="button"
                  className={`admin-panel-button admin-highlight-button${occurrenceMode === "single" ? " admin-highlight-new" : ""}`}
                  onClick={() => setOccurrenceMode("single")}
                >
                  Pojedynczy termin
                </button>
                <button
                  type="button"
                  className={`admin-panel-button admin-highlight-button${occurrenceMode === "weekly" ? " admin-highlight-new" : ""}`}
                  onClick={() => setOccurrenceMode("weekly")}
                >
                  Co tydzień (cyklicznie)
                </button>
              </div>

              <label>
                <span>{occurrenceMode === "single" ? "Data i godzina" : "Data i godzina pierwszego terminu"}</span>
                <input
                  type="datetime-local"
                  value={occurrenceStartsAt}
                  onChange={(e) => setOccurrenceStartsAt(e.target.value)}
                />
              </label>
              <label>
                <span>Czas trwania (minuty)</span>
                <input
                  type="number"
                  min="1"
                  value={occurrenceDuration}
                  onChange={(e) => setOccurrenceDuration(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Pojemność</span>
                <input
                  type="number"
                  min="1"
                  value={occurrenceCapacity}
                  onChange={(e) => setOccurrenceCapacity(Number(e.target.value))}
                />
              </label>
              {occurrenceMode === "weekly" && (
                <label>
                  <span>Liczba tygodni</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={occurrenceWeeks}
                    onChange={(e) => setOccurrenceWeeks(Number(e.target.value))}
                  />
                </label>
              )}

              {occurrenceFormError && <p className="admin-form-error">{occurrenceFormError}</p>}

              <button className="admin-panel-button admin-save-button" type="submit" disabled={isSavingOccurrence}>
                {isSavingOccurrence
                  ? "Zapisywanie..."
                  : occurrenceMode === "single"
                    ? "Dodaj termin"
                    : `Dodaj ${occurrenceWeeks} terminów`}
              </button>
            </form>
          </section>

          <section className="admin-panel-section" aria-label="Nadchodzące terminy">
            <span className="admin-section-label">Nadchodzące terminy ({occurrences.length})</span>
            {occurrences.length === 0 ? (
              <p className="admin-empty-note">Brak nadchodzących terminów.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sekcja</TableHead>
                    <TableHead>Kiedy</TableHead>
                    <TableHead>Zajęte</TableHead>
                    <TableHead>Oczekujący</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occurrences.map((occurrence) => (
                    <TableRow key={occurrence.id}>
                      <TableCell>{sectionNameById.get(occurrence.sectionId) ?? "—"}</TableCell>
                      <TableCell>{dateTimeFormatter.format(new Date(occurrence.startsAt))}</TableCell>
                      <TableCell>
                        {occurrence.confirmedCount} / {occurrence.capacity}
                      </TableCell>
                      <TableCell>{occurrence.waitlistedCount}</TableCell>
                      <TableCell>
                        {cancellingOccurrenceId === occurrence.id ? (
                          <div className="admin-inline-confirm">
                            <button
                              className="admin-confirm-button admin-confirm-danger"
                              type="button"
                              onClick={() => handleCancelOccurrence(occurrence.id)}
                            >
                              ✔
                            </button>
                            <button
                              className="admin-confirm-button admin-confirm-cancel"
                              type="button"
                              onClick={() => setCancellingOccurrenceId(null)}
                            >
                              ✖
                            </button>
                          </div>
                        ) : (
                          <button
                            className="admin-panel-button admin-row-delete"
                            type="button"
                            onClick={() => setCancellingOccurrenceId(occurrence.id)}
                          >
                            Anuluj
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        {/* ================= INSTRUKTORZY ================= */}
        <TabsContent value="instructors" className="admin-schedule-tabcontent">
          <section className="admin-sector-panel" aria-label="Formularz instruktora">
            <div>
              <span className="admin-section-label">{editingInstructorId ? "Edytuj instruktora" : "Nowy instruktor"}</span>
            </div>
            <form className="admin-field-grid" onSubmit={handleInstructorSubmit}>
              <label>
                <span>Imię i nazwisko</span>
                <input
                  type="text"
                  value={instructorDraft.name}
                  onChange={(e) => setInstructorDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label>
                <span>Bio</span>
                <input
                  type="text"
                  value={instructorDraft.bio}
                  onChange={(e) => setInstructorDraft((d) => ({ ...d, bio: e.target.value }))}
                  placeholder="Krótka notka, uprawnienia itp."
                />
              </label>

              {instructorFormError && <p className="admin-form-error">{instructorFormError}</p>}

              <div className="admin-dialog-confirm-row">
                {editingInstructorId && (
                  <button className="admin-panel-button" type="button" onClick={cancelEditInstructor}>
                    Anuluj edycję
                  </button>
                )}
                <button className="admin-panel-button admin-save-button" type="submit" disabled={isSavingInstructor}>
                  {isSavingInstructor ? "Zapisywanie..." : editingInstructorId ? "Zapisz zmiany" : "Dodaj instruktora"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-panel-section" aria-label="Lista instruktorów">
            <span className="admin-section-label">Instruktorzy ({instructors.length})</span>
            {instructors.length === 0 ? (
              <p className="admin-empty-note">Brak instruktorów — dodaj pierwszego powyżej.</p>
            ) : (
              <div className="admin-boulder-list">
                {instructors.map((instructor) => (
                  <div className="admin-boulder-row" key={instructor.id}>
                    <button className="admin-boulder-identity" type="button" onClick={() => startEditInstructor(instructor)}>
                      <span className="admin-boulder-dot">{instructor.name.charAt(0).toUpperCase()}</span>
                      <span>{instructor.name}</span>
                    </button>
                    {deleteInstructorConfirmId === instructor.id ? (
                      <div className="admin-inline-confirm">
                        <button
                          className="admin-confirm-button admin-confirm-danger"
                          type="button"
                          onClick={() => handleDeleteInstructor(instructor.id)}
                        >
                          ✔
                        </button>
                        <button
                          className="admin-confirm-button admin-confirm-cancel"
                          type="button"
                          onClick={() => setDeleteInstructorConfirmId(null)}
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <button
                        className="admin-panel-button admin-row-delete"
                        type="button"
                        onClick={() => setDeleteInstructorConfirmId(instructor.id)}
                      >
                        usuń
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ================= STATYSTYKI ================= */}
        <TabsContent value="stats" className="admin-schedule-tabcontent">
          {isStatsLoading ? (
            <p className="admin-empty-note">Ładowanie statystyk...</p>
          ) : statsError ? (
            <p className="schedule-error">{statsError}</p>
          ) : stats ? (
            <>
              <div className="admin-stats-grid">
                <div className="admin-stats-card">
                  <strong>{stats.totalSections}</strong>
                  <span>sekcji</span>
                </div>
                <div className="admin-stats-card">
                  <strong>{stats.totalInstructors}</strong>
                  <span>instruktorów</span>
                </div>
                <div className="admin-stats-card">
                  <strong>{stats.upcomingOccurrenceCount}</strong>
                  <span>nadchodzących terminów</span>
                </div>
                <div className="admin-stats-card">
                  <strong>{stats.totalConfirmedBookings}</strong>
                  <span>potwierdzonych zapisów</span>
                </div>
                <div className="admin-stats-card">
                  <strong>{stats.totalWaitlisted}</strong>
                  <span>na liście oczekujących</span>
                </div>
              </div>

              <section className="admin-panel-section" aria-label="Popularność sekcji">
                <span className="admin-section-label">Popularność sekcji (nadchodzące terminy)</span>
                {stats.bySection.length === 0 ? (
                  <p className="admin-empty-note">Brak danych — dodaj sekcje i terminy.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sekcja</TableHead>
                        <TableHead>Terminy</TableHead>
                        <TableHead>Zapisani</TableHead>
                        <TableHead>Obłożenie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.bySection.map((row) => (
                        <TableRow key={row.sectionId}>
                          <TableCell>{row.sectionName}</TableCell>
                          <TableCell>{row.occurrenceCount}</TableCell>
                          <TableCell>{row.totalConfirmed}</TableCell>
                          <TableCell>{Math.round(row.occupancyRate * 100)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </main>
  );
}
