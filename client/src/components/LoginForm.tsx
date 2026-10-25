/**
 * LoginForm — Formularz logowania (admin i klient)
 * =================================================
 * variant="admin" (domyślny): bramka wyświetlana, gdy URL zawiera ?admin=1 a użytkownik
 *   nie jest zalogowany jako admin. Po zalogowaniu Supabase sprawdza rolę w user_roles.
 *   Użycie bez propsów (<LoginForm />) działa jak dotychczas.
 * variant="client": logowanie klienta w module rezerwacji (konto z RegisterForm).
 */
import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { AuthDialog } from "./AuthDialog";

type LoginFormProps = {
  variant?: "admin" | "client";
  /** Wariant "client": link "Nie masz konta? Zarejestruj się" */
  onSwitchToRegister?: () => void;
  /** Wywoływane po udanym logowaniu (np. żeby zamknąć dialog) */
  onLoggedIn?: () => void;
  /** Podane = dialog da się zamknąć (×, Escape, tapnięcie tła). Bramka admina nie ma zamknięcia. */
  onClose?: () => void;
};

const COPY = {
  admin: {
    eyebrow: "Waller staff",
    title: "Logowanie admina",
    lead: "Zaloguj się, aby zarządzać boulderami i sektorami.",
    emailPlaceholder: "admin@waller.pl",
  },
  client: {
    eyebrow: "Karma Climbing",
    title: "Zaloguj się",
    lead: "Zaloguj się, aby zapisać się na zajęcia.",
    emailPlaceholder: "twoj@email.pl",
  },
} as const;

export function LoginForm({ variant = "admin", onSwitchToRegister, onLoggedIn, onClose }: LoginFormProps) {
  const { signIn } = useAuth();
  const copy = COPY[variant];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else {
      onLoggedIn?.();
    }
    setIsSubmitting(false);
  };

  return (
    <AuthDialog titleId="login-title" onClose={onClose}>
      <div className="login-header">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="login-title">{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
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
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logowanie..." : "Zaloguj się"}
        </button>
      </form>

      {variant === "client" && onSwitchToRegister && (
        <p className="login-switch">
          Nie masz konta?{" "}
          <button className="login-switch-button" type="button" onClick={onSwitchToRegister}>
            Zarejestruj się
          </button>
        </p>
      )}
    </AuthDialog>
  );
}
