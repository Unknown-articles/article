import { useState } from 'react';
import { register, login } from '../utils/api';

function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = mode === 'login' ? await login(username, password) : await register(username, password);
      localStorage.setItem('chat_token', result.token);
      localStorage.setItem('chat_user', JSON.stringify({ userId: result.userId, username: result.username }));
      onLogin({ userId: result.userId, username: result.username });
    } catch (err) {
      setError(err.message);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit} className="auth-form">
      <div className="tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={`tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={`tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Register
        </button>
      </div>
      <div className="form-group">
        <input
          data-testid="input-username"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength="3"
          required
        />
      </div>
      <div className="form-group">
        <input
          data-testid="input-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength="6"
          required
        />
      </div>
      <button data-testid="btn-submit" type="submit" className="btn-submit">
        {mode === 'login' ? 'Login' : 'Register'}
      </button>
      {error && <div data-testid="auth-error" className="error">{error}</div>}
    </form>
  );
}

export default AuthForm;