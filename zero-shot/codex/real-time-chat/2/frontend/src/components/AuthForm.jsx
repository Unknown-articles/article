import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      onAuthenticated({
        token: data.token,
        user: { userId: data.userId, username: data.username },
      });
    } catch {
      setError('Unable to reach the chat server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="auth-panel"
      data-testid="auth-form"
      data-mode={mode}
      onSubmit={handleSubmit}
    >
      <div className="brand-block">
        <h1>Real-Time Chat</h1>
      </div>

      <div className="tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === 'login' ? 'active' : ''}
          aria-selected={mode === 'login'}
          onClick={() => switchMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === 'register' ? 'active' : ''}
          aria-selected={mode === 'register'}
          onClick={() => switchMode('register')}
        >
          Register
        </button>
      </div>

      {error ? (
        <div className="error-banner" data-testid="auth-error" role="alert">
          {error}
        </div>
      ) : null}

      <label>
        Username
        <input
          data-testid="input-username"
          minLength="3"
          autoComplete="username"
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
          minLength={mode === 'register' ? 6 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <button data-testid="btn-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
      </button>
    </form>
  );
}
