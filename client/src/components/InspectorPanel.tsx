/**
 * Design reminder — Swiss Utility Cartography:
 * panel nie konkuruje z mapą. Iteracja 7 usuwa widoczne nazwy boulderów,
 * zostawiając wycentrowany nagłówek: etykieta Boulder, pin grade i nazwa sektora.
 */
import type { BoulderPin, Sector, Selection } from "../types";
import { getGradeColor, getHoldColor } from "../data/gymMap";

type InspectorPanelProps = {
  selection: Selection;
  sectors: Sector[];
  boulders: BoulderPin[];
};

export function InspectorPanel({ selection, sectors, boulders }: InspectorPanelProps) {
  if (!selection) {
    return (
      <aside className="inspector inspector-empty" aria-label="Instrukcja mapy">
        <div className="eyebrow">Mapa po QR</div>
        <h2>Wybierz sektor lub boulder</h2>
        <p>
          Tapnij kolorową pinezkę, aby zobaczyć <strong>autora</strong>, <strong>kolor chwytów</strong> i <strong>grade</strong>. Tapnij sektor,
          aby sprawdzić <strong>datę montażu</strong>, <strong>demontażu</strong> i autora.
        </p>
      </aside>
    );
  }

  if (selection.type === "boulder") {
    const boulder = boulders.find((item) => item.id === selection.id);
    if (!boulder) return null;

    const sector = sectors.find((item) => item.id === boulder.sectorId);
    const holdColor = getHoldColor(boulder.holdColor);
    const gradeColor = getGradeColor(boulder.grade);

    return (
      <aside className="inspector" aria-label={`Szczegóły bouldera, trudność ${boulder.grade}, sektor ${sector?.name ?? "Sektor"}`}>
        <div className="boulder-inspector-hero">
          <div className="eyebrow">Boulder</div>
          <div className="grade-badge grade-badge-centered" style={{ background: gradeColor.hex, color: gradeColor.text }}>
            {boulder.grade}
          </div>
          <p>{sector?.name ?? "Sektor"}</p>
        </div>

        <dl className="data-list">
          <div>
            <dt>Autor</dt>
            <dd>{boulder.author}</dd>
          </div>
          <div>
            <dt>Kolor chwytów</dt>
            <dd className="hold-color-value">
              <span className="hold-swatch" style={{ background: holdColor.hex }} />
              {holdColor.label}
            </dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>{boulder.grade}</dd>
          </div>
        </dl>
      </aside>
    );
  }

  const sector = sectors.find((item) => item.id === selection.id);
  if (!sector) return null;

  return (
    <aside className="inspector" aria-label={`Szczegóły sektora ${sector.name}`}>
      <div className="eyebrow">Sektor {sector.code}</div>
      <h2>{sector.name}</h2>
      <p>{sector.description}</p>

      <dl className="data-list">
        <div>
          <dt>Data montażu</dt>
          <dd>{sector.settingDate}</dd>
        </div>
        <div>
          <dt>Data demontażu</dt>
          <dd>{sector.removalDate}</dd>
        </div>
        <div>
          <dt>Autor</dt>
          <dd>{sector.author}</dd>
        </div>
      </dl>
    </aside>
  );
}
