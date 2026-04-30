import { useState } from 'react';

const API = 'http://localhost:5000';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function switchMode(m) {
    setMode(m);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      onAuth(data);
    } catch {
      setError('Network error. Is the server running?');
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Chat App</h1>

        <div style={styles.tabs}>
          <button
            data-testid="tab-login"
            onClick={() => switchMode('login')}
            style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
          >
            Login
          </button>
          <button
            data-testid="tab-register"
            onClick={() => switchMode('register')}
            style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
          >
            Register
          </button>
        </div>

        <form
          data-testid="auth-form"
          data-mode={mode}
          onSubmit={handleSubmit}
          style={styles.form}
        >
          <input
            data-testid="input-username"
            type="text"
            placeholder="Username"
            value={username}
            minLength={3}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={styles.input}
          />
          <input
            data-testid="input-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />

          {error && (
            <p data-testid="auth-error" style={styles.error}>
              {error}
            </p>
          )}

          <button data-testid="btn-submit" type="submit" style={styles.btn}>
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '2rem',
    width: 360,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  },
  title: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    fontSize: '1.5rem',
    color: '#111',
  },
  tabs: {
    display: 'flex',
    marginBottom: '1.5rem',
    borderBottom: '2px solid #e5e7eb',
  },
  tab: {
    flex: 1,
    padding: '0.6rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: '#6b7280',
    fontWeight: 500,
  },
  tabActive: {
    color: '#2563eb',
    borderBottom: '2px solid #2563eb',
    marginBottom: -2,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    padding: '0.65rem 0.9rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: '0.95rem',
    outline: 'none',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.85rem',
  },
  btn: {
    padding: '0.7rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.95rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
