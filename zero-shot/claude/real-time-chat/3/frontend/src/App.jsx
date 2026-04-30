import { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const userRaw = localStorage.getItem('chat_user');
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw);
        setSession({ token, ...user });
      } catch {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
      }
    }
  }, []);

  function handleAuth({ token, userId, username }) {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify({ userId, username }));
    setSession({ token, userId, username });
  }

  function handleLogout() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setSession(null);
  }

  if (session) {
    return <Chat session={session} onLogout={handleLogout} />;
  }

  return <AuthForm onAuth={handleAuth} />;
}
