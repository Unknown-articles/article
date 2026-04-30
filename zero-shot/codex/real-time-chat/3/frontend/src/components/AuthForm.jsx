import { useState } from 'react';
import { authenticate } from '../api.js';

export function AuthForm({ onAuthenticated }) {
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
      const session = await authenticate(mode, { username, password });
      onAuthenticated(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit}>
      <div className="tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          data-testid="tab-login"
          onClick={() => switchMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          data-testid="tab-register"
          onClick={() => switchMode('register')}
        >
          Register
        </button>
      </div>

      {error ? (
        <div className="error" data-testid="auth-error">
          {error}
        </div>
      ) : null}

      <label>
        Username
        <input
          data-testid="input-username"
          minLength="3"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>

      <label>
        Password
        <input
          data-testid="input-password"
          type="password"
          minLength="6"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <button type="submit" data-testid="btn-submit" disabled={isSubmitting}>
        {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
      </button>
    </form>
  );
}
