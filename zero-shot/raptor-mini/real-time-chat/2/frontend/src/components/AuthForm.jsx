import { useEffect, useState } from 'react';

function AuthForm({ onAuthSuccess, apiUrl }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError('');
  }, [mode]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Authentication error');
      } else {
        onAuthSuccess(data);
      }
    } catch {
      setError('Unable to reach authentication server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>
      <form data-testid="auth-form" data-mode={mode} onSubmit={submit}>
        <label>
          Username
          <input
            data-testid="input-username"
            minLength={3}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            data-testid="input-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error ? <div data-testid="auth-error" className="error-message">{error}</div> : null}
        <button data-testid="btn-submit" type="submit" disabled={submitting}>
          {mode === 'login' ? 'Log in' : 'Register'}
        </button>
      </form>
    </div>
  );
}

export default AuthForm;
