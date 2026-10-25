/**
 * AuthDialog — wspólna oprawa formularzy logowania i rejestracji
 * ================================================================
 * Pełnoekranowy overlay + kremowa karta (style: AuthForms.css).
 * Jeśli podasz onClose, dialog pokazuje przycisk × i zamyka się także po
 * Escape oraz po tapnięciu w tło. Bez onClose (bramka admina) nie da się go zamknąć.
 */
import { useEffect, type ReactNode } from "react";
import "./AuthForms.css";

type AuthDialogProps = {
  /** id nagłówka (h2) wewnątrz dialogu — używane w aria-labelledby */
  titleId: string;
  onClose?: () => void;
  children: ReactNode;
};

export function AuthDialog({ titleId, onClose, children }: AuthDialogProps) {
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="login-overlay"
      // pointerdown zamiast click: działa też na iOS i nie zamyka okna, gdy ktoś zaznacza
      // tekst w polu i puszcza palec poza kartą (pointerdown startuje wtedy w karcie).
      onPointerDown={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <section className="login-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {onClose && (
          <button type="button" className="login-close" onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        )}
        {children}
      </section>
    </div>
  );
}
