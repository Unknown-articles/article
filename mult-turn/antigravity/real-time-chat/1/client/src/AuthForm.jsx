import React, { useState } from 'react';
import './AuthForm.css';

export default function AuthForm({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    setError(''); // Clear error immediately
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        localStorage.setItem('chat_token', data.token);
        localStorage.setItem('chat_user', JSON.stringify({ userId: data.userId, username: data.username }));
        onLoginSuccess({ userId: data.userId, username: data.username });
      }
    } catch (err) {
      setError('Network error, please try again later.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome</h2>
          <p>Please enter your details to continue</p>
        </div>
        
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            data-testid="tab-login"
            onClick={() => handleTabSwitch('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            data-testid="tab-register"
            onClick={() => handleTabSwitch('register')}
          >
            Register
          </button>
        </div>

        <form
          className="auth-form"
          data-testid="auth-form"
          data-mode={mode}
          onSubmit={handleSubmit}
        >
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              data-testid="input-username"
              minLength="3"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              data-testid="input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="auth-error" data-testid="auth-error">
              {error}
            </div>
          )}

          <button type="submit" className="submit-btn" data-testid="btn-submit">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
