import { useState } from "react";
import { authenticate } from "../api";

export function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = await authenticate(mode, { username, password });
      onAuthenticated({
        token: payload.token,
        user: {
          userId: payload.userId,
          username: payload.username,
        },
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            data-testid="tab-login"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            data-testid="tab-register"
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        <form
          data-testid="auth-form"
          data-mode={mode}
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <h1>Signal Room</h1>
          <p className="auth-copy">Sign in or create an account to join the chat.</p>

          <label>
            Username
            <input
              data-testid="input-username"
              minLength="3"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              data-testid="input-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <p data-testid="auth-error" className="error-text">
              {error}
            </p>
          ) : null}

          <button data-testid="btn-submit" type="submit" disabled={submitting}>
            {submitting ? "Working..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
      </section>
    </main>
  );
}
