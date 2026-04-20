import { useState } from 'react';
import * as api from './api.js';

export default function AuthForm({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await (mode === 'login'
        ? api.login(username, password)
        : api.register(username, password));
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      data-testid="auth-form"
      data-mode={mode}
      onSubmit={handleSubmit}
    >
      <div>
        <button
          type="button"
          data-testid="tab-login"
          onClick={() => switchMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          onClick={() => switchMode('register')}
        >
          Register
        </button>
      </div>

      <input
        data-testid="input-username"
        type="text"
        placeholder="Username"
        minLength="3"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />

      <input
        data-testid="input-password"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      {error && <div data-testid="auth-error">{error}</div>}

      <button type="submit" data-testid="btn-submit" disabled={loading}>
        {mode === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
}
