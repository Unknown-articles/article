import { useState, useEffect, useRef } from 'react';
import './index.css';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleTabChange = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      onLogin(data.token, { userId: data.userId, username: data.username });
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="glass-container auth-container">
      <div className="auth-tabs">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => handleTabChange('login')}
          data-testid="tab-login"
        >
          Login
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => handleTabChange('register')}
          data-testid="tab-register"
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} data-testid="auth-form" data-mode={mode}>
        {error && <div className="error-banner" data-testid="auth-error">{error}</div>}
        
        <div className="input-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            data-testid="input-username"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            data-testid="input-password"
            required
          />
        </div>

        <button type="submit" className="btn-primary" data-testid="btn-submit">
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function Chat({ token, user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState('');
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev, data]);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        onLogout();
      } else {
        setError('Disconnected from server');
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };

    return () => {
      ws.close();
    };
  }, [token, onLogout]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({ type: 'message', content: inputValue }));
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-container" data-testid="chat-container">
      <div className="chat-header">
        <div className="user-info">
          <div 
            className="connection-status" 
            data-testid="connection-status" 
            data-connected={connected}
          >
            <div className={`status-dot ${connected ? 'online' : ''}`} />
            {connected ? 'Online' : 'Offline'}
          </div>
          <div className="message-username" data-testid="current-username">
            {user.username}
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout} data-testid="btn-logout">
          Logout
        </button>
      </div>

      {error && <div className="error-banner" data-testid="connection-error" style={{borderRadius: 0}}>{error}</div>}

      <div className="message-list" data-testid="message-list">
        {messages.length === 0 ? (
          <div className="empty-state" data-testid="message-empty">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === user.userId;
            return (
              <div 
                key={msg.id} 
                className={`message-item ${isOwn ? 'own' : 'other'}`}
                data-testid="message-item"
                data-own={isOwn}
                data-message-id={msg.id}
              >
                <div className="message-meta">
                  <span className="message-username" data-testid="message-username">
                    {isOwn ? 'You' : msg.username}
                  </span>
                  <span className="message-timestamp" data-testid="message-timestamp">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="message-bubble" data-testid="message-content">
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="input-field"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="input-message"
        />
        <button 
          className="btn-send" 
          onClick={handleSend} 
          disabled={inputValue.trim().length === 0}
          data-testid="btn-send"
        >
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('chat_user');
        localStorage.removeItem('chat_token');
      }
    }
    setIsLoaded(true);
  }, []);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('chat_token', newToken);
    localStorage.setItem('chat_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
  };

  if (!isLoaded) return null;

  return (
    <>
      {token && user ? (
        <Chat token={token} user={user} onLogout={handleLogout} />
      ) : (
        <AuthForm onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
