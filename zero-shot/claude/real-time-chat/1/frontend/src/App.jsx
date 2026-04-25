import { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('chat_token');
    const storedUser = localStorage.getItem('chat_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  function handleAuthSuccess({ token, userId, username }) {
    const userObj = { userId, username };
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(userObj));
    setToken(token);
    setUser(userObj);
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

  return <AuthForm onSuccess={handleAuthSuccess} />;
}
