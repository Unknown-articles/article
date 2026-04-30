import React, { useState } from 'react';

const API = 'http://localhost:5000';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function switchTab(newMode) {
    setMode(newMode);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify({ userId: data.userId, username: data.username }));
      onAuth(data.token, { userId: data.userId, username: data.username });
    } catch {
      setError('Network error');
    }
  }

  return (
    <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit}>
      <div>
        <button type="button" data-testid="tab-login" onClick={() => switchTab('login')}>
          Login
        </button>
        <button type="button" data-testid="tab-register" onClick={() => switchTab('register')}>
          Register
        </button>
      </div>
      <div>
        <input
          data-testid="input-username"
          type="text"
          placeholder="Username"
          value={username}
          minLength={3}
          required
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          data-testid="input-password"
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div data-testid="auth-error">{error}</div>}
      <button type="submit" data-testid="btn-submit">
        {mode === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
}
