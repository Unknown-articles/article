import React, { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm';
import Chat from './components/Chat';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('chat_token');
    const storedUser = localStorage.getItem('chat_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (token, user) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setToken(null);
    setUser(null);
  };

  return (
    <div className="App">
      {user ? <Chat user={user} token={token} onLogout={handleLogout} /> : <AuthForm onLogin={handleLogin} />}
    </div>
  );
}

export default App;