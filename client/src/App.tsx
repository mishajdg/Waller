/**
 * Iteracja 10 — Karma branding + przycisk Zapisz w panelu admina
 * ================================================================
 * Nagłówek: logo Karma + nazwa obiektu (zamiast "Waller topo").
 * Panel admina: metadane sektora przechowywane w local state,
 * wysyłane do Supabase dopiero po kliknięciu "Zapisz".
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { InspectorPanel } from "./components/InspectorPanel";
import { LoginForm } from "./components/LoginForm";
import { WallMap } from "./components/WallMap";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
} from "./components/ui/drawer";
import { useAuth } from "./contexts/AuthContext";
import { useGymData } from "./hooks/useGymData";
import { useBoulderActions } from "./hooks/useBoulderActions";
import { useSectorActions } from "./hooks/useSectorActions";
import {
  GRADE_COLORS,
  HOLD_COLORS,
  getGradeColor,
} from "./data/gymMap";
import {
  getBouldersForSectorSorted,
  isValidBoulderGrade,
  layoutBouldersByDifficulty,
} from "./lib/boulderLayout";
import { getSegmentsForSector } from "./lib/geometry";
import type { BoulderGrade, BoulderPin, HoldColorKey, Sector, SectorHighlight, Selection } from "./types";

const holdColorOptions = Object.entries(HOLD_COLORS) as Array<[HoldColorKey, typeof HOLD_COLORS[HoldColorKey]]>;

const parseBoulderGrade = (value: string): BoulderGrade | null => {
  const parsed = Number(value);
  return isValidBoulderGrade(parsed) ? parsed : null;
};

type AddBoulderDraft = {
  sectorId: string;
  gradeInput: string;
  holdColor: HoldColorKey;
  holdColorOpen: boolean;
  author: string;
  error?: string;
};

type HighlightConfirm = {
  sectorId: string;
  highlight: SectorHighlight;
  nextHighlight: SectorHighlight | null;
};

/** Local draft for sector metadata — changes are NOT sent until user clicks "Zapisz" */
type SectorMetaDraft = {
  sectorId: string;
  settingDate: string;
  removalDate: string;
  author: string;
  dirty: boolean;
};

/**
 * Sprawdza URL — czy wejście jest przez QR admin
 */
const isAdminEntry = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1" || window.location.pathname.includes("admin");
};

function App() {
  // === AUTH ===
  const { isAdmin: isAuthAdmin, isLoading: isAuthLoading, signOut } = useAuth();
  const wantsAdmin = isAdminEntry();

  // Admin jest aktywny TYLKO jeśli: (1) URL mówi admin, (2) użytkownik jest zalogowany jako admin
  const isAdmin = wantsAdmin && isAuthAdmin;

  // === DANE Z SUPABASE ===
  const { sectors, boulders: rawBoulders, wallSegments, isLoading: isDataLoading, error: dataError } = useGymData();
  const { addBoulder, deleteBoulder, clearSector } = useBoulderActions();
  const { updateSectorMeta, updateSectorHighlight } = useSectorActions();

  // Layoutuj bouldery na segmentach (zachowaj logikę z mock wersji)
  const boulders = useMemo(
    () => layoutBouldersByDifficulty(rawBoulders, wallSegments),
    [rawBoulders, wallSegments]
  );

  // === LOCAL UI STATE ===
  const [selection, setSelection] = useState<Selection>(null);
  const [zoomedSectorId, setZoomedSectorId] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<AddBoulderDraft | null>(null);
  const [inlineDeleteId, setInlineDeleteId] = useState<string | null>(null);
  const [clearConfirmSectorId, setClearConfirmSectorId] = useState<string | null>(null);
  const [highlightConfirm, setHighlightConfirm] = useState<HighlightConfirm | null>(null);
  const [metaDraft, setMetaDraft] = useState<SectorMetaDraft | null>(null);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  // Lokalne draft usunięć — bouldery zaznaczone do usunięcia, ale jeszcze nie wysłane do Supabase
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const selectedSector = useMemo(() => sectors.find((sector) => sector.id === zoomedSectorId) ?? null, [sectors, zoomedSectorId]);
  const selectedSectorBoulders = useMemo(
    () => (selectedSector ? getBouldersForSectorSorted(boulders, selectedSector.id) : []),
    [boulders, selectedSector],
  );

  // Sync metaDraft when selectedSector changes
  useEffect(() => {
    if (selectedSector && isAdmin) {
      setMetaDraft({
        sectorId: selectedSector.id,
        settingDate: selectedSector.settingDate,
        removalDate: selectedSector.removalDate,
        author: selectedSector.author,
        dirty: false,
      });
      setMetaSaved(false);
      setPendingDeletes(new Set()); // Reset draft usunięć przy zmianie sektora
    } else {
      setMetaDraft(null);
      setPendingDeletes(new Set());
    }
  }, [selectedSector?.id, isAdmin]);

  const visibleBoulderCount = selectedSector ? selectedSectorBoulders.length : boulders.length;
  const overlayLabel = selectedSector ? `bouldery w sektorze ${selectedSector.code}` : "bouldery na mapie";
  const addDraftGrade = addDraft ? parseBoulderGrade(addDraft.gradeInput) : null;
  const addDraftGradeColor = addDraftGrade ? GRADE_COLORS[addDraftGrade] : null;
  const addDraftHoldColor = addDraft ? HOLD_COLORS[addDraft.holdColor] : null;

  // === LOADING / ERROR STATES ===
  if (isAuthLoading || isDataLoading) {
    return (
      <main className="app-shell" aria-label="Ładowanie">
        <div className="loading-screen">
          <p className="eyebrow">Karma</p>
          <p>Ładowanie mapy...</p>
        </div>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="app-shell" aria-label="Błąd">
        <div className="loading-screen">
          <p className="eyebrow">Karma</p>
          <p>Błąd ładowania danych: {dataError}</p>
          <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Sprawdź konfigurację Supabase (.env.local) i czy tabele zostały utworzone.
          </p>
        </div>
      </main>
    );
  }

  // === ADMIN LOGIN GATE ===
  if (wantsAdmin && !isAuthAdmin) {
    return <LoginForm />;
  }

  // === HANDLERS ===
  const handleAddBoulderRequest = (sectorId: string) => {
    if (!isAdmin) return;
    const sectorAuthor = sectors.find((sector) => sector.id === sectorId)?.author.trim();
    setAddDraft({
      sectorId,
      gradeInput: "4",
      holdColor: "blue",
      holdColorOpen: false,
      author: sectorAuthor || "Routesetter Karma",
    });
  };

  const handleAddBoulderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addDraft) return;

    const grade = parseBoulderGrade(addDraft.gradeInput);
    const holdColor = addDraft.holdColor;

    if (!grade) {
      setAddDraft((draft) => draft ? { ...draft, error: "Wpisz trudność jako liczbę od 1 do 10." } : draft);
      return;
    }

    const sectorSegments = getSegmentsForSector(addDraft.sectorId, wallSegments);
    const targetSegment = sectorSegments[0];
    const sectorBoulderNumber = boulders.filter((boulder) => boulder.sectorId === addDraft.sectorId).length + 1;
    const sectorCode = sectors.find((sector) => sector.id === addDraft.sectorId)?.code ?? "S";
    const fallbackPoint = sectors.find((sector) => sector.id === addDraft.sectorId)?.label ?? { x: 500, y: 360 };

    try {
      await addBoulder({
        sectorId: addDraft.sectorId,
        segmentId: targetSegment?.id ?? "",
        name: `Boulder ${sectorCode}.${sectorBoulderNumber}`,
        grade,
        holdColor,
        author: addDraft.author.trim() || "Routesetter Karma",
        position: targetSegment?.start ?? fallbackPoint,
      });

      setAddDraft(null);
      setInlineDeleteId(null);
      setClearConfirmSectorId(null);
      setHighlightConfirm(null);
    } catch (err: any) {
      setAddDraft((draft) => draft ? { ...draft, error: err.message || "Błąd zapisu" } : draft);
    }
  };

  // Zaznacz boulder do usunięcia (lokalnie, bez wysyłania do Supabase)
  const handleInlineDeleteBoulder = (boulderId: string) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.add(boulderId);
      return next;
    });
    setInlineDeleteId(null);
    // Jeśli zaznaczony boulder jest aktualnie wybrany, odrzuć zaznaczenie
    if (selection?.type === "boulder" && selection.id === boulderId) {
      setSelection(zoomedSectorId ? { type: "sector", id: zoomedSectorId } : null);
    }
  };

  // Cofnij zaznaczenie do usunięcia (lokalnie)
  const handleUndoDeleteBoulder = (boulderId: string) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.delete(boulderId);
      return next;
    });
  };

  // Zaznacz wszystkie bouldery sektora do usunięcia (lokalnie)
  const handleClearSector = (sectorId: string) => {
    const sectorBoulderIds = boulders
      .filter((b) => b.sectorId === sectorId)
      .map((b) => b.id);
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      sectorBoulderIds.forEach((id) => next.add(id));
      return next;
    });
    setInlineDeleteId(null);
    setClearConfirmSectorId(null);
    setHighlightConfirm(null);
  };

  /** Batch save — wysyła do Supabase:
   *  1. Metadane sektora (jeśli zmienione)
   *  2. Usunięcia bouldeŕów (jeśli są pending)
   *  Strona NIE odświeża się podczas edycji — wszystko idzie jednym przyciskiem. */
  const handleSaveMetadata = async () => {
    const hasMeta = metaDraft?.dirty;
    const hasDeletes = pendingDeletes.size > 0;
    if (!hasMeta && !hasDeletes) return;
    setMetaSaving(true);
    // WAŻNE: Skopiuj Set do lokalnej zmiennej PRZED async operations.
    // React może re-renderować komponent w trakcie await (np. realtime refetch),
    // co spowoduje że pendingDeletes w closure będzie już nowym, pustym Set.
    const deletesToProcess = new Set(pendingDeletes);
    const metaSnapshot = metaDraft ? { ...metaDraft } : null;
    try {
      // 1. Zapisz metadane sektora
      if (hasMeta && metaSnapshot) {
        await updateSectorMeta(metaSnapshot.sectorId, "setting_date", metaSnapshot.settingDate);
        await updateSectorMeta(metaSnapshot.sectorId, "removal_date", metaSnapshot.removalDate);
        await updateSectorMeta(metaSnapshot.sectorId, "author", metaSnapshot.author);
        setMetaDraft((prev) => prev ? { ...prev, dirty: false } : prev);
      }
      // 2. Wykonaj usunięcia bouldeŕów (równolegle) — używamy lokalnej kopii
      if (hasDeletes) {
        await Promise.all(Array.from(deletesToProcess).map((id) => deleteBoulder(id)));
        // Usuń tylko te ID które faktycznie przetworzyliśmy (nie czyść nowych)
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          deletesToProcess.forEach((id) => next.delete(id));
          return next;
        });
      }
      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 3000);
    } catch (err) {
      console.error("Save metadata error:", err);
    } finally {
      setMetaSaving(false);
    }
  };

  const requestHighlightChange = (sector: Sector, highlight: SectorHighlight) => {
    const nextHighlight = sector.highlight === highlight ? null : highlight;
    setHighlightConfirm({ sectorId: sector.id, highlight, nextHighlight });
    setClearConfirmSectorId(null);
    setInlineDeleteId(null);
  };

  const applyHighlightChange = async () => {
    if (!highlightConfirm) return;
    try {
      await updateSectorHighlight(highlightConfirm.sectorId, highlightConfirm.nextHighlight);
      setHighlightConfirm(null);
    } catch (err) {
      console.error("Update highlight error:", err);
    }
  };

  const cancelHighlightChange = () => setHighlightConfirm(null);

  const getHighlightButtonLabel = (sector: Sector, highlight: SectorHighlight) => {
    if (highlight === "new") return sector.highlight === "new" ? "Odznacz sektor jako nowy" : "Oznacz sektor jako nowy";
    return sector.highlight === "removal" ? "Odznacz sektor do demontażu" : "Oznacz sektor do demontażu";
  };

  return (
    <main className={`app-shell ${isAdmin ? "admin-shell" : ""}`} aria-label="Karma mapa boulderów">
      {/* === HEADER — Karma branding === */}
      <header className="app-kiosk-header">
        <div className="karma-header-brand">
          {/* Logo Karma PNG — biały symbol K w hexagonie (IMG_8101, RGBA) */}
          <img
            src="/logo-karma.png"
            alt="Logo Karma Climbing"
            className="karma-logo-img"
            aria-label="Logo Karma"
          />
          {/* Nazwa obiektu */}
          <span className="karma-header-name">KARMA</span>
        </div>
        {/* Przycisk trybu — pozostaje do końca developmentu */}
        <div className="header-mode-btn-wrap">
          {isAdmin ? (
            <button className="mode-pill mode-pill--admin" type="button" onClick={() => signOut()}>
              Tryb admin
            </button>
          ) : (
            <a
              href="?admin=1"
              className="mode-pill mode-pill--client"
              aria-label="Włącz tryb admina"
            >
              Tryb klient
            </a>
          )}
        </div>
      </header>

      <section className="map-workspace" aria-label="Mapa sektorów Karma">
        <div className="map-stage">
          <div className="boulder-count-overlay" aria-label={`${visibleBoulderCount} ${overlayLabel}`}>
            <strong>{visibleBoulderCount}</strong>
            <span>{overlayLabel}</span>
          </div>

          <WallMap
            sectors={sectors}
            segments={wallSegments}
            boulders={boulders}
            selection={selection}
            isAdmin={isAdmin}
            onSelectSector={(id) => setSelection({ type: "sector", id })}
            onSelectBoulder={(id) => {
              // Kliknięcie pinu bouldera:
              // 1. Ustaw selection — InspectorPanel pokaże dane bouldera
              // 2. Zawsze ustaw zoomedSectorId na sektor bouldera
              //    (nie tylko gdy null) — drawer otworzy się i zoom wycentruje sektor
              setSelection({ type: "boulder", id });
              const b = boulders.find((boulder) => boulder.id === id);
              if (b) {
                setZoomedSectorId(b.sectorId);
              }
            }}
            onZoomSectorChange={(id) => {
              setZoomedSectorId(id);
              // Przy zoom-in otwiera się drawer automatycznie (open={!!zoomedSectorId})
              // Przy zoom-out (id=null) drawer zamknie się przez onOpenChange
            }}
            onClearSelection={() => setSelection(null)}
          />
        </div>

      </section>

      {/* === BOTTOM DRAWER ===
           modal={false} → mapa pozostaje klikalna gdy drawer jest otwarty.
           Aby zmienić zachowanie: modal={true} = overlay blokuje mapę.
           Drawer zamknie się przez przeciągnięcie w dół lub tapnięcie poza nim. */}
      <Drawer
        open={!!zoomedSectorId}
        onOpenChange={(open) => {
          if (!open) {
            setZoomedSectorId(null);
            setSelection(null);
            setHighlightConfirm(null);
            setClearConfirmSectorId(null);
            setInlineDeleteId(null);
          }
        }}
        direction="bottom"
        modal={false}
      >
          <DrawerContent className="karma-drawer">
            {/* === PRZYCISK ZAMKNIJ (X) ===
                 DrawerClose z Vaul automatycznie zamyka drawer po kliknięciu.
                 Aby zmienić pozycję: edytuj .karma-drawer-close w index.css.
                 Aby zmienić ikonkę: zmień znak × na dowolny tekst/SVG. */}
            <DrawerClose className="karma-drawer-close" aria-label="Zamknij panel">
              ×
            </DrawerClose>
            {/* Scrollowalny obszar drawera */}
            {/* data-vaul-no-drag: cały body drawera nie jest drag-handle’em.
                Dzięki temu scroll, inputy i dropdowny działają poprawnie. */}
            <div className="karma-drawer-body" data-vaul-no-drag>
              {/* InspectorPanel — szczegóły sektora lub bouldera */}
              <InspectorPanel
                selection={selection}
                sectors={sectors}
                boulders={boulders}
              />

              {/* Panel admina — tylko dla zalogowanego admina */}
              {isAdmin && selectedSector && (
                <aside
                  className="admin-sector-panel"
                  aria-label={`Edycja metadanych sektora ${selectedSector.name}`}
                  // data-vaul-no-drag: zapobiega traktowaniu panelu admina
                  // jako drag handle drawera — umożliwia scroll i edycję pól
                  data-vaul-no-drag
                >
                  <div>
                    <p className="eyebrow">Panel admina</p>
                    <h2>Metadane sektora</h2>
                  </div>

                  {metaDraft && (
                    <div className="admin-field-grid">
                      <label>
                        <span>Data montażu</span>
                        <input
                          type="date"
                          value={metaDraft.settingDate}
                          onChange={(event) => setMetaDraft((prev) => prev ? { ...prev, settingDate: event.target.value, dirty: true } : prev)}
                        />
                      </label>
                      <label>
                        <span>Data demontażu</span>
                        <input
                          type="date"
                          value={metaDraft.removalDate}
                          onChange={(event) => setMetaDraft((prev) => prev ? { ...prev, removalDate: event.target.value, dirty: true } : prev)}
                        />
                      </label>
                      <label>
                        <span>Autor</span>
                        <input
                          type="text"
                          value={metaDraft.author}
                          onChange={(event) => setMetaDraft((prev) => prev ? { ...prev, author: event.target.value, dirty: true } : prev)}
                        />
                      </label>
                      {/* Przycisk Zapisz przeniesiony na koniec panelu */}
                    </div>
                  )}

                  <section className="admin-panel-section" aria-label="Podświetlenie sektora">
                    <div>
                      <span className="admin-section-label">Podświetlenie sektora</span>
                      <p>Oznaczenie jest widoczne dla klienta i staffu w widoku ogólnym oraz po wejściu w sektor.</p>
                    </div>
                    <div className="admin-highlight-actions">
                      {(["new", "removal"] as SectorHighlight[]).map((highlight) => {
                        const isConfirming = highlightConfirm?.sectorId === selectedSector.id && highlightConfirm.highlight === highlight;
                        const isRemoval = highlight === "removal";
                        return isConfirming ? (
                          <div className="admin-inline-confirm admin-highlight-confirm" key={highlight}>
                            <button className={isRemoval ? "admin-confirm-button admin-confirm-danger" : "admin-confirm-button admin-confirm-accept"} type="button" onClick={applyHighlightChange}>✔</button>
                            <button className="admin-confirm-button admin-confirm-cancel" type="button" onClick={cancelHighlightChange}>✖</button>
                          </div>
                        ) : (
                          <button
                            className={`admin-panel-button admin-highlight-button ${isRemoval ? "admin-highlight-removal" : "admin-highlight-new"}`}
                            type="button"
                            key={highlight}
                            onClick={() => requestHighlightChange(selectedSector, highlight)}
                          >
                            {getHighlightButtonLabel(selectedSector, highlight)}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="admin-panel-section" aria-label="Czyszczenie sektora">
                    <div>
                      <span className="admin-section-label">Wyczyść sektor</span>
                      <p>Usuwa wszystkie bouldery przypisane do aktualnie wybranego sektora.</p>
                    </div>
                    {clearConfirmSectorId === selectedSector.id ? (
                      <div className="admin-inline-confirm admin-clear-confirm">
                        <button className="admin-confirm-button admin-confirm-danger" type="button" onClick={() => handleClearSector(selectedSector.id)}>✔</button>
                        <button className="admin-confirm-button admin-confirm-cancel" type="button" onClick={() => setClearConfirmSectorId(null)}>✖</button>
                      </div>
                    ) : (
                      <button
                        className="admin-panel-button admin-clear-button"
                        type="button"
                        disabled={selectedSectorBoulders.length === 0}
                        onClick={() => setClearConfirmSectorId(selectedSector.id)}
                      >
                        Wyczyść sektor
                      </button>
                    )}
                  </section>

                  <section className="admin-panel-section" aria-label="Lista boulderów sektora">
                    <div className="admin-section-heading">
                      <span className="admin-section-label">Bouldery</span>
                      <button className="admin-panel-button admin-add-button" type="button" onClick={() => handleAddBoulderRequest(selectedSector.id)}>
                        Dodaj boulder
                      </button>
                    </div>
                    <div className="admin-boulder-list">
                      {selectedSectorBoulders.length === 0 ? (
                        <p className="admin-empty-note">Ten sektor nie ma aktualnie przypisanych boulderów.</p>
                      ) : (
                        selectedSectorBoulders.map((boulder) => {
                          const gradeColor = getGradeColor(boulder.grade);
                          const isPending = pendingDeletes.has(boulder.id);
                          const isConfirming = inlineDeleteId === boulder.id;
                          return (
                            <div className={`admin-boulder-row${isPending ? " admin-boulder-pending-delete" : ""}`} key={boulder.id}>
                              <button
                                className="admin-boulder-identity admin-boulder-pin-only"
                                type="button"
                                aria-label={`Pokaż boulder o trudności ${boulder.grade}`}
                                onClick={() => !isPending && setSelection({ type: "boulder", id: boulder.id })}
                              >
                                <span className="admin-boulder-dot" style={{ background: gradeColor.hex, color: gradeColor.text, opacity: isPending ? 0.4 : 1 }}>
                                  {boulder.grade}
                                </span>
                              </button>
                              {isPending ? (
                                <div className="admin-inline-confirm">
                                  <span className="admin-pending-label">do usunięcia</span>
                                  <button className="admin-confirm-button admin-confirm-cancel" type="button" title="Cofnij usunięcie" onClick={() => handleUndoDeleteBoulder(boulder.id)}>✖</button>
                                </div>
                              ) : isConfirming ? (
                                <div className="admin-inline-confirm">
                                  <button className="admin-confirm-button admin-confirm-danger" type="button" onClick={() => handleInlineDeleteBoulder(boulder.id)}>✔</button>
                                  <button className="admin-confirm-button admin-confirm-cancel" type="button" onClick={() => setInlineDeleteId(null)}>✖</button>
                                </div>
                              ) : (
                                <button className="admin-panel-button admin-row-delete" type="button" onClick={() => setInlineDeleteId(boulder.id)}>usuń</button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {/* === PRZYCISK ZAPISZ — na końcu panelu, wysyła WSZYSTKO do Supabase === */}
                  <div className="admin-save-footer">
                    {pendingDeletes.size > 0 && (
                      <p className="admin-pending-summary">
                        {pendingDeletes.size} boulder{pendingDeletes.size === 1 ? " do usunięcia" :  "y do usunięcia"} — niezapisane
                      </p>
                    )}
                    <button
                      className="admin-panel-button admin-save-button admin-save-button-full"
                      type="button"
                      disabled={(!metaDraft?.dirty && pendingDeletes.size === 0) || metaSaving}
                      onClick={handleSaveMetadata}
                    >
                      {metaSaving ? "Zapisywanie..." : metaSaved ? "✔ Zapisano" : "Zapisz metadane"}
                    </button>
                  </div>
                </aside>
              )}
            </div>
          {/* === MODAL DODAJ BOULDER ===
               MUSI być wewnątrz DrawerContent (w FocusScope Vaul).
               Gdy modal=false, Vaul wywołuje onFocusOutside.preventDefault()
               dla elementów POZA drawerem — blokuje focus na inputach.
               position:fixed + z-index:200 sprawia że modal jest wizualnie
               nad drawerem mimo bycia w jego drzewie DOM. */}
          {addDraft && (
            <div
              className="waller-modal-backdrop"
              role="presentation"
              data-vaul-no-drag
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
          <section
            className="waller-modal waller-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-boulder-title"
            aria-describedby="add-boulder-description"
          >
            <div className="waller-modal-header">
              <p className="eyebrow">Panel admina</p>
              <h2 id="add-boulder-title">Dodaj boulder</h2>
              <p id="add-boulder-description">Wpisz grade 1–10 i kolor chwytów. Pin zostanie automatycznie ułożony na linii sektora według trudności.</p>
            </div>

            <form className="admin-form" onSubmit={handleAddBoulderSubmit} data-vaul-no-drag>
              <label>
                <span>Grade</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  inputMode="numeric"
                  value={addDraft.gradeInput}
                  onChange={(event) => setAddDraft((draft) => draft ? { ...draft, gradeInput: event.target.value, error: undefined } : draft)}
                  placeholder="1-10"
                />
              </label>
              <label className="admin-form-select-field">
                <span>Kolor chwytów</span>
                <div className={`hold-color-select ${addDraft.holdColorOpen ? "is-open" : ""}`}>
                  <button
                    className="hold-color-select-trigger"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={addDraft.holdColorOpen}
                    onClick={() => setAddDraft((draft) => draft ? { ...draft, holdColorOpen: !draft.holdColorOpen, error: undefined } : draft)}
                  >
                    <span className="hold-color-select-value">
                      <span className="hold-swatch" style={{ background: addDraftHoldColor?.hex ?? "transparent" }} />
                      {addDraftHoldColor?.label ?? "Wybierz kolor"}
                    </span>
                    <span className="hold-color-select-arrow" aria-hidden="true">⌄</span>
                  </button>

                  {addDraft.holdColorOpen && (
                    <div className="hold-color-select-menu" role="listbox" aria-label="Kolor chwytów">
                      {holdColorOptions.map(([key, color]) => (
                        <button
                          key={key}
                          className="hold-color-option"
                          type="button"
                          role="option"
                          aria-selected={addDraft.holdColor === key}
                          onClick={() => setAddDraft((draft) => draft ? { ...draft, holdColor: key, holdColorOpen: false, error: undefined } : draft)}
                        >
                          <span className="hold-swatch" style={{ background: color.hex }} />
                          <span>{color.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label>
                <span>Autor</span>
                <input
                  type="text"
                  value={addDraft.author}
                  onChange={(event) => setAddDraft((draft) => draft ? { ...draft, author: event.target.value, error: undefined } : draft)}
                  placeholder="Imię routesettera"
                />
              </label>

              <div className="admin-form-preview" aria-label="Podgląd nowego bouldera">
                <div>
                  <span className="admin-section-label">Podgląd pina</span>
                  <div className="admin-preview-pin" style={{ background: addDraftGradeColor?.hex ?? "#fffdf8", color: addDraftGradeColor?.text ?? "#29251e" }}>
                    {addDraftGrade ?? "?"}
                  </div>
                </div>
                <div>
                  <span className="admin-section-label">Kolor chwytów</span>
                  <div className="admin-preview-hold">
                    <span className="hold-swatch" style={{ background: addDraftHoldColor?.hex ?? "transparent" }} />
                    <strong>{addDraftHoldColor?.label ?? "Wpisz kolor z listy"}</strong>
                  </div>
                </div>
              </div>

              {addDraft.error && <p className="admin-form-error">{addDraft.error}</p>}

              <div className="admin-dialog-confirm-row" aria-label="Zatwierdź albo anuluj dodawanie bouldera">
                <button className="admin-confirm-button admin-confirm-accept" type="submit" aria-label="Zatwierdź dodanie bouldera">
                  ✔
                </button>
                <button className="admin-confirm-button admin-confirm-cancel" type="button" onClick={() => setAddDraft(null)} aria-label="Anuluj dodawanie bouldera">
                  ✖
                </button>
              </div>
            </form>
          </section>
        </div>
          )}
          </DrawerContent>
      </Drawer>
    </main>
  );
}

export default App;
