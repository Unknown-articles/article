import { useEffect, useState } from 'react';
import { AuthForm } from './components/AuthForm.jsx';
import { Chat } from './components/Chat.jsx';
import { clearSession, loadSession, saveSession } from './storage.js';

export function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  function handleAuthenticated(authSession) {
    saveSession(authSession);
    setSession({
      token: authSession.token,
      user: { userId: authSession.userId, username: authSession.username },
    });
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  if (!session) {
    return (
      <main className="auth-page">
        <AuthForm onAuthenticated={handleAuthenticated} />
      </main>
    );
  }

  return <Chat session={session} onLogout={handleLogout} />;
}
