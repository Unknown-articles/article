import React, { useState } from 'react';

const AuthForm = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const baseUrl = 'http://localhost:5000'; // Could be configured

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify({ userId: data.userId, username: data.username }));

      onAuthSuccess({ token: data.token, user: { userId: data.userId, username: data.username } });
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Welcome to Real-Time Chat</h2>
      <div className="tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => handleModeSwitch('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => handleModeSwitch('register')}
        >
          Register
        </button>
      </div>

      <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            data-testid="input-username"
            minLength="3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            data-testid="input-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        {error && <div data-testid="auth-error" className="error-message">{error}</div>}

        <button type="submit" data-testid="btn-submit" className="submit-btn">
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default AuthForm;
