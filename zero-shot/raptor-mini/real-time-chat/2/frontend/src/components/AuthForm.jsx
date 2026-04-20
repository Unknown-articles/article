import { useState } from "react";

const initialMode = "login";

function AuthForm({ apiHost, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

  const handleModeChange = (newMode) => {
    if (newMode === mode) {
      return;
    }
    setMode(newMode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${apiHost}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to authenticate");
      }

      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-shell">
      <div className="tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === "login" ? "active" : ""}
          onClick={() => handleModeChange("login")}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === "register" ? "active" : ""}
          onClick={() => handleModeChange("register")}
        >
          Register
        </button>
      </div>

      <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit} className="auth-form">
        <label>
          Username
          <input
            data-testid="input-username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
          />
        </label>

        <label>
          Password
          <input
            data-testid="input-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        <button data-testid="btn-submit" type="submit" className="submit-button">
          {mode === "login" ? "Login" : "Register"}
        </button>

        {error ? (
          <div data-testid="auth-error" className="form-error">
            {error}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export default AuthForm;
