/**
 * RegisterForm — rejestracja klienta (self-service) w module rezerwacji
 * ======================================================================
 * Klient zakłada zwykłe konto Supabase Auth (imię i nazwisko + e-mail + hasło).
 * Do user_roles NIE trzeba nic dopisywać: AuthContext.fetchRole() traktuje każdego
 * zalogowanego użytkownika bez wiersza w user_roles jako "viewer" (klient).
 *
 * Dwa możliwe przebiegi (zależnie od ustawienia "Confirm email" w Supabase):
 *  - włączone (domyślnie): konto powstaje, ale sesja dopiero po kliknięciu linku
 *    z maila → pokazujemy ekran "Sprawdź skrzynkę"
 *  - wyłączone: użytkownik jest zalogowany od razu → wołamy onRegistered()
 */
import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { AuthDialog } from "./AuthDialog";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

type RegisterFormProps = {
  /** Link "Masz już konto? Zaloguj się" oraz przycisk na ekranie "Sprawdź skrzynkę" */
  onSwitchToLogin?: () => void;
  /** Wywoływane, gdy rejestracja zakończyła się od razu zalogowaniem (bez potwierdzania maila) */
  onRegistered?: () => void;
  /** Podane = dialog da się zamknąć (×, Escape, tapnięcie tła) */
  onClose?: () => void;
};

export function RegisterForm({ onSwitchToLogin, onRegistered, onClose }: RegisterFormProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Adres, na który poszedł mail z linkiem — ustawiony = pokazujemy ekran "Sprawdź skrzynkę" */
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const name = fullName.trim();
    const mail = email.trim();

    if (name.length < 2) {
      setError("Podaj imię i nazwisko.");
      return;
    }
    if (!EMAIL_PATTERN.test(mail)) {
      setError("Podaj poprawny adres e-mail.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
      return;
    }
    if (password !== passwordRepeat) {
      setError("Hasła nie są takie same.");
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(mail, password, name);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setConfirmationSentTo(mail);
      return;
    }
    onRegistered?.();
  };

  // Ekran po wysłaniu maila z linkiem aktywacyjnym
  if (confirmationSentTo) {
    return (
      <AuthDialog titleId="register-title" onClose={onClose}>
        <div className="login-header">
          <p className="eyebrow">Karma Climbing</p>
          <h2 id="register-title">Sprawdź skrzynkę</h2>
          <p>
            Wysłaliśmy link aktywacyjny na adres <strong>{confirmationSentTo}</strong>. Kliknij go,
            aby potwierdzić konto — potem możesz się zalogować i zapisać na zajęcia.
          </p>
          <p className="login-hint">Nie widzisz wiadomości? Zajrzyj do folderu Spam.</p>
        </div>
        {onSwitchToLogin && (
          <button className="login-submit" type="button" onClick={onSwitchToLogin}>
            Przejdź do logowania
          </button>
        )}
      </AuthDialog>
    );
  }

  return (
    <AuthDialog titleId="register-title" onClose={onClose}>
      <div className="login-header">
        <p className="eyebrow">Karma Climbing</p>
        <h2 id="register-title">Załóż konto</h2>
        <p>Konto pozwala zapisać się na zajęcia i zarządzać swoimi zapisami.</p>
      </div>

      {/* noValidate: walidujemy sami, żeby komunikaty były po polsku */}
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label>
          <span>Imię i nazwisko</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Anna Kowalska"
            required
            autoComplete="name"
          />
        </label>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            required
            autoComplete="email"
          />
        </label>

        <label>
          <span>Hasło</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Min. ${MIN_PASSWORD_LENGTH} znaków`}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </label>

        <label>
          <span>Powtórz hasło</span>
          <input
            type="password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Zakładanie konta..." : "Załóż konto"}
        </button>
      </form>

      {onSwitchToLogin && (
        <p className="login-switch">
          Masz już konto?{" "}
          <button className="login-switch-button" type="button" onClick={onSwitchToLogin}>
            Zaloguj się
          </button>
        </p>
      )}
    </AuthDialog>
  );
}
