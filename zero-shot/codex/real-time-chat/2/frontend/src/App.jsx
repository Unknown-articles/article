import { useEffect, useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

const STORAGE_TOKEN_KEY = 'chat_token';
const STORAGE_USER_KEY = 'chat_user';

function loadStoredSession() {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const rawUser = localStorage.getItem(STORAGE_USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser);
    if (!user?.userId || !user?.username) {
      return null;
    }

    return { token, user };
  } catch {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(loadStoredSession());
  }, []);

  function handleAuthenticated(authSession) {
    localStorage.setItem(STORAGE_TOKEN_KEY, authSession.token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authSession.user));
    setSession(authSession);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setSession(null);
  }

  return (
    <main className="app-shell">
      {session ? (
        <Chat session={session} onLogout={handleLogout} />
      ) : (
        <AuthForm onAuthenticated={handleAuthenticated} />
      )}
    </main>
  );
}
