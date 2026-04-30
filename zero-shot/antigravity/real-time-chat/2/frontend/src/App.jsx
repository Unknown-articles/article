import { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm';
import Chat from './components/Chat';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const userStr = localStorage.getItem('chat_user');
    if (token && userStr) {
      try {
        setSession({ token, user: JSON.parse(userStr) });
      } catch (e) {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
      }
    }
  }, []);

  const handleAuthSuccess = ({ token, userId, username }) => {
    const user = { userId, username };
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    setSession({ token, user });
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setSession(null);
  };

  return (
    <>
      {!session ? (
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      ) : (
        <Chat user={session.user} token={session.token} onLogout={handleLogout} />
      )}
    </>
  );
}
