/**
 * ScheduleView — widok grafiku i zapisów na sekcje wspinaczkowe
 * =================================================================
 * Publiczna lista sekcji (grup cyklicznych i dropinów) z nadchodzącymi
 * terminami i żywą zajętością (realtime). Zalogowany klient może się
 * zapisać, dołączyć do listy oczekujących (automatycznie, gdy pełne)
 * albo anulować własną rezerwację.
 *
 * Klik "Zapisz się" bez sesji zapamiętuje zamierzony termin i otwiera
 * logowanie/rejestrację w miejscu — po udanym zalogowaniu z miejsca
 * wraca do dokańczania tego zapisu (patrz handleAuthed).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useClassSchedule } from "../hooks/useClassSchedule";
import { useBookingActions } from "../hooks/useBookingActions";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";
import type { OccurrenceWithAvailability } from "../types";
import "./ScheduleView.css";

const dateFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });

function formatWhen(occurrence: OccurrenceWithAvailability) {
  const start = new Date(occurrence.startsAt);
  const end = new Date(occurrence.endsAt);
  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

const KIND_LABEL: Record<string, string> = {
  recurring: "Grupa cykliczna",
  dropin: "Dropin",
  individual: "Trening indywidualny",
};

type AuthView = "login" | "register" | null;

export default function ScheduleView() {
  const { isLoggedIn, isLoading: isAuthLoading, displayName, signOut } = useAuth();
  const { schedule, isLoading, error } = useClassSchedule();
  const { bookOccurrence, cancelBooking, isSubmitting } = useBookingActions();

  const [authView, setAuthView] = useState<AuthView>(null);
  // Termin, który klient próbował zarezerwować przed zalogowaniem — dokańczamy go po powrocie
  const [pendingOccurrenceId, setPendingOccurrenceId] = useState<string | null>(null);
  const [phoneDraftOccurrenceId, setPhoneDraftOccurrenceId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const totalUpcoming = useMemo(
    () => schedule.reduce((sum, entry) => sum + entry.occurrences.length, 0),
    [schedule]
  );

  if (isAuthLoading) {
    return (
      <main className="app-shell" aria-label="Ładowanie">
        <div className="schedule-loading">
          <p className="eyebrow">Karma</p>
          <p>Ładowanie...</p>
        </div>
      </main>
    );
  }

  const startBooking = (occurrenceId: string) => {
    setActionError(null);
    if (!isLoggedIn) {
      setPendingOccurrenceId(occurrenceId);
      setAuthView("login");
      return;
    }
    setPhoneDraftOccurrenceId(occurrenceId);
  };

  const confirmBooking = async (occurrenceId: string) => {
    setActionError(null);
    try {
      await bookOccurrence(occurrenceId, displayName ?? "", phone);
      setPhoneDraftOccurrenceId(null);
      setPhone("");
    } catch (err: any) {
      setActionError(err.message || "Nie udało się zapisać.");
    }
  };

  const handleCancel = async (bookingId: string) => {
    setActionError(null);
    try {
      await cancelBooking(bookingId);
    } catch (err: any) {
      setActionError(err.message || "Nie udało się anulować.");
    }
  };

  // Po udanym logowaniu/rejestracji z natychmiastową sesją — wróć do przerwanego zapisu.
  // Gdy trzeba potwierdzić e-mail, sesji jeszcze nie ma — po prostu wracamy do grafiku.
  const handleAuthed = () => {
    setAuthView(null);
    if (pendingOccurrenceId) {
      setPhoneDraftOccurrenceId(pendingOccurrenceId);
      setPendingOccurrenceId(null);
    }
  };

  const closeAuthDialog = () => {
    setAuthView(null);
    setPendingOccurrenceId(null);
  };

  return (
    <main className="app-shell">
      <header className="app-kiosk-header">
        <div className="karma-header-brand">
          <img src="/logo-karma.png" alt="Logo Karma Climbing" className="karma-logo-img" aria-label="Logo Karma" />
          <span className="karma-header-name">KARMA</span>
        </div>
        <div className="header-mode-btn-wrap schedule-header-actions">
          <Link href="/" className="mode-pill">
            ← Mapa
          </Link>
          {isLoggedIn ? (
            <button className="mode-pill" type="button" onClick={() => signOut()}>
              Wyloguj{displayName ? ` (${displayName.split(" ")[0]})` : ""}
            </button>
          ) : (
            <>
              <button className="mode-pill" type="button" onClick={() => setAuthView("login")}>
                Zaloguj się
              </button>
              <button className="mode-pill" type="button" onClick={() => setAuthView("register")}>
                Zarejestruj się
              </button>
            </>
          )}
        </div>
      </header>

      <section className="schedule-intro" aria-label="Grafik sekcji wspinaczkowych">
        <p className="eyebrow">Karma Climbing</p>
        <h1>Zajęcia i sekcje</h1>
        <p className="schedule-lead">
          {isLoading
            ? "Ładowanie grafiku..."
            : totalUpcoming === 0
              ? "Brak nadchodzących terminów."
              : `${totalUpcoming} ${totalUpcoming === 1 ? "nadchodzący termin" : "nadchodzących terminów"}.`}
        </p>
      </section>

      {error && <p className="schedule-error">{error}</p>}
      {actionError && <p className="schedule-error">{actionError}</p>}

      <section className="schedule-list" aria-label="Lista sekcji">
        {schedule.map(({ section, occurrences }) => (
          <article className="schedule-section-card" key={section.id}>
            <header className="schedule-section-header">
              <div>
                <span className="schedule-kind-badge">{KIND_LABEL[section.kind] ?? section.kind}</span>
                <h2>{section.name}</h2>
                {section.instructorName && <p className="schedule-instructor">Prowadzi: {section.instructorName}</p>}
              </div>
              {section.priceInfo && <span className="schedule-price">{section.priceInfo}</span>}
            </header>

            {section.description && <p className="schedule-description">{section.description}</p>}

            {occurrences.length === 0 ? (
              <p className="schedule-empty-note">Brak zaplanowanych terminów.</p>
            ) : (
              <ul className="schedule-occurrence-list">
                {occurrences.map((occurrence) => {
                  const { myBooking } = occurrence;
                  const isFull = occurrence.spotsLeft <= 0;
                  const isDraftingPhone = phoneDraftOccurrenceId === occurrence.id;

                  return (
                    <li className="schedule-occurrence-row" key={occurrence.id}>
                      <div className="schedule-occurrence-when">
                        <strong>{formatWhen(occurrence)}</strong>
                        <span className={`schedule-spots${isFull ? " is-full" : ""}`}>
                          {isFull
                            ? occurrence.waitlistedCount > 0
                              ? `Pełne — ${occurrence.waitlistedCount} os. na liście oczekujących`
                              : "Pełne"
                            : `${occurrence.spotsLeft} / ${occurrence.capacity} miejsc`}
                        </span>
                      </div>

                      {myBooking ? (
                        <div className="schedule-occurrence-action schedule-booked">
                          <span className={`schedule-booking-status ${myBooking.status}`}>
                            {myBooking.status === "confirmed" ? "Zapisano ✓" : "Lista oczekujących"}
                          </span>
                          <button
                            className="schedule-cancel-button"
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleCancel(myBooking.id)}
                          >
                            Anuluj
                          </button>
                        </div>
                      ) : isDraftingPhone ? (
                        <form
                          className="schedule-phone-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            confirmBooking(occurrence.id);
                          }}
                        >
                          <input
                            type="tel"
                            placeholder="Telefon (opcjonalnie)"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            autoFocus
                          />
                          <button className="schedule-book-button" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Zapisywanie..." : "Potwierdź"}
                          </button>
                          <button
                            className="schedule-cancel-button"
                            type="button"
                            onClick={() => setPhoneDraftOccurrenceId(null)}
                          >
                            Anuluj
                          </button>
                        </form>
                      ) : (
                        <button className="schedule-book-button" type="button" onClick={() => startBooking(occurrence.id)}>
                          {isFull ? "Dołącz do listy oczekujących" : "Zapisz się"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </section>

      {authView === "login" && (
        <LoginForm
          variant="client"
          onSwitchToRegister={() => setAuthView("register")}
          onLoggedIn={handleAuthed}
          onClose={closeAuthDialog}
        />
      )}
      {authView === "register" && (
        <RegisterForm onSwitchToLogin={() => setAuthView("login")} onRegistered={handleAuthed} onClose={closeAuthDialog} />
      )}
    </main>
  );
}
