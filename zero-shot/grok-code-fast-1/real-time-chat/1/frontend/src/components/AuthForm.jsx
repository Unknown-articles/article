import { useState } from 'react';

function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        onLogin(data.token, { userId: data.userId, username: data.username });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setUsername('');
    setPassword('');
  };

  return (
    <form
      data-testid="auth-form"
      data-mode={mode}
      onSubmit={handleSubmit}
      className="auth-form"
    >
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
          required
        />
      </div>
      <button data-testid="btn-submit" type="submit" className="btn-primary">
        {mode === 'login' ? 'Login' : 'Register'}
      </button>
      {error && <div data-testid="auth-error" className="error">{error}</div>}
    </form>
  );
}

export default AuthForm;