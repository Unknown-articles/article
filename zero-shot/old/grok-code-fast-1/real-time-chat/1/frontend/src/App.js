import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('login');

  useEffect(() => {
    if (token) {
      setView('chat');
    }
  }, [token]);

  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
    setView('chat');
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setView('login');
  };

  return (
    <div className="App">
      {view === 'login' && (
        <div>
          <Login onLogin={handleLogin} />
          <button onClick={() => setView('register')}>Register</button>
        </div>
      )}
      {view === 'register' && (
        <div>
          <Register onRegister={() => setView('login')} />
          <button onClick={() => setView('login')}>Back to Login</button>
        </div>
      )}
      {view === 'chat' && <Chat token={token} onLogout={handleLogout} />}
    </div>
  );
}

export default App;