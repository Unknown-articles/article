import { useState } from 'react';

export default function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="auth-container">
      <div className="auth-tabs">
        <button 
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => switchMode('login')}
          data-testid="tab-login"
          type="button"
        >
          Login
        </button>
        <button 
          className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => switchMode('register')}
          data-testid="tab-register"
          type="button"
        >
          Register
        </button>
      </div>
      <form 
        className="auth-form" 
        onSubmit={handleSubmit} 
        data-testid="auth-form" 
        data-mode={mode}
      >
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={e => setUsername(e.target.value)} 
          data-testid="input-username"
          minLength={3}
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          data-testid="input-password"
          minLength={6}
          required 
        />
        {error && <div className="auth-error" data-testid="auth-error">{error}</div>}
        <button type="submit" data-testid="btn-submit">
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
    </div>
  );
}
