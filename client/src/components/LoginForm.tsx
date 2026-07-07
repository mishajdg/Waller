/**
 * LoginForm — Formularz logowania dla admina
 * =============================================
 * Wyświetlany, gdy URL zawiera ?admin=1 a użytkownik nie jest zalogowany.
 * Po zalogowaniu Supabase sprawdza rolę w tabeli user_roles.
 */
import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="login-overlay">
      <section className="login-card" role="dialog" aria-label="Logowanie admina">
        <div className="login-header">
          <p className="eyebrow">Waller staff</p>
          <h2>Logowanie admina</h2>
          <p>Zaloguj się, aby zarządzać boulderami i sektorami.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@waller.pl"
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

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>
      </section>
    </div>
  );
}
