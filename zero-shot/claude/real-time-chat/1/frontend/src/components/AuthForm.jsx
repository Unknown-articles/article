import { useState } from 'react';

const API = 'http://localhost:3000';

export default function AuthForm({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function switchTab(newMode) {
    setMode(newMode);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
      } else {
        onSuccess(data);
      }
    } catch {
      setError('Cannot reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <h1 className="auth-title">Real-time Chat</h1>

      <div className="auth-tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => switchTab('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
          onClick={() => switchTab('register')}
        >
          Register
        </button>
      </div>

      <form
        data-testid="auth-form"
        data-mode={mode}
        className="auth-form-fields"
        onSubmit={handleSubmit}
      >
        <div className="field-group">
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            type="text"
            data-testid="input-username"
            minLength="3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />
        </div>

        <div className="field-group">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            data-testid="input-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </div>

        <button
          type="submit"
          data-testid="btn-submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
        </button>

        {error && (
          <div data-testid="auth-error" className="auth-error">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
