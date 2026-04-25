import { useState } from 'react';
import * as api from './api.js';

export default function AuthForm({ onSuccess }) {
  const [formMode, setFormMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function changeMode(next) {
    setFormMode(next);
    setFormError('');
  }

  async function onFormSubmit(e) {
    e.preventDefault();
    setFormError('');
    setIsLoading(true);
    try {
      const data = await (formMode === 'login'
        ? api.login(username, password)
        : api.register(username, password));
      onSuccess(data);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      data-testid="auth-form"
      data-mode={formMode}
      onSubmit={onFormSubmit}
    >
      <div>
        <button
          type="button"
          data-testid="tab-login"
          onClick={() => changeMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          onClick={() => changeMode('register')}
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

      {formError && <div data-testid="auth-error">{formError}</div>}

      <button type="submit" data-testid="btn-submit" disabled={isLoading}>
        {formMode === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
}
