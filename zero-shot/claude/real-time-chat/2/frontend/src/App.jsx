import React, { useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

function loadSession() {
  const token = localStorage.getItem('chat_token');
  const userStr = localStorage.getItem('chat_user');
  if (token && userStr) {
    try {
      return { token, user: JSON.parse(userStr) };
    } catch {
      return null;
    }
  }
  return null;
}

export default function App() {
  const session = loadSession();
  const [token, setToken] = useState(session?.token || null);
  const [user, setUser] = useState(session?.user || null);

  function handleAuth(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setToken(null);
    setUser(null);
  }

  if (token && user) {
    return <Chat token={token} user={user} onLogout={handleLogout} />;
  }

  return <AuthForm onAuth={handleAuth} />;
}
