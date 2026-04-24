import { useState } from "react";

export function AuthPanel({ onSubmit, onSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const switchAuthMode = (nextMode) => {
    if (nextMode === mode) {
      return;
    }
    setMode(nextMode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      const user = await onSubmit({
        mode,
        username: username.trim(),
        password,
      });
      onSuccess(user);
    } catch (submitError) {
      setError(submitError?.message || "Authentication failed");
    }
  };

  return (
    <form data-testid="auth-form" data-mode={mode} className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === "login" ? "active" : ""}
          onClick={() => switchAuthMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === "register" ? "active" : ""}
          onClick={() => switchAuthMode("register")}
        >
          Register
        </button>
      </div>

      <label htmlFor="username">Username</label>
      <input
        id="username"
        name="username"
        data-testid="input-username"
        type="text"
        minLength={3}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        data-testid="input-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button type="submit" data-testid="btn-submit">
        {mode === "login" ? "Login" : "Register"}
      </button>

      {error ? (
        <div data-testid="auth-error" className="auth-error">
          {error}
        </div>
      ) : null}
    </form>
  );
}
