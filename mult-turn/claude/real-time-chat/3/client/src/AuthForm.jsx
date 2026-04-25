import { useState } from 'react';
import * as api from './api.js';

export default function AuthForm({ onSuccess }) {
  const [activeMode, setActiveMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleForm(next) {
    setActiveMode(next);
    setErrorMsg('');
  }

  async function processSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const data = await (activeMode === 'login'
        ? api.login(username, password)
        : api.register(username, password));
      onSuccess(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      data-testid="auth-form"
      data-mode={activeMode}
      onSubmit={processSubmit}
    >
      <div>
        <button
          type="button"
          data-testid="tab-login"
          onClick={() => toggleForm('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          onClick={() => toggleForm('register')}
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

      {errorMsg && <div data-testid="auth-error">{errorMsg}</div>}

      <button type="submit" data-testid="btn-submit" disabled={submitting}>
        {activeMode === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
}
