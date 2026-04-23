import { useRef, useState } from 'react';
import { submitAuthRequest } from './api.js';
import { AuthForm } from './components/AuthForm.jsx';
import { ChatView } from './components/ChatView.jsx';

const TOKEN_STORAGE_KEY = 'chat_token';
const USER_STORAGE_KEY = 'chat_user';

function getStoredSession() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!token || !storedUser) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(storedUser)
    };
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function App() {
  const initialSession = getStoredSession();
  const socketRef = useRef(null);
  const [token, setToken] = useState(initialSession?.token ?? null);
  const [user, setUser] = useState(initialSession?.user ?? null);

  async function handleAuthSubmit(mode, credentials) {
    const authResult = await submitAuthRequest(mode, credentials);
    const nextUser = {
      userId: authResult.userId,
      username: authResult.username
    };

    localStorage.setItem(TOKEN_STORAGE_KEY, authResult.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(authResult.token);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setToken(null);
    setUser(null);
  }

  function handleAuthClose() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setToken(null);
    setUser(null);
  }

  return (
    <main className="app-shell">
      <section className={token && user ? 'chat-layout' : 'auth-layout'} aria-label="Real-Time Chat">
        <div className="brand-panel">
          <p className="eyebrow">Real-Time Chat</p>
          <h1>Sign in to keep the conversation moving.</h1>
          <p>
            A lean chat client is taking shape here, with authentication first
            and live messaging next.
          </p>
        </div>
        {token && user ? (
          <ChatView
            onAuthClose={handleAuthClose}
            onLogout={handleLogout}
            socketRef={socketRef}
            token={token}
            user={user}
          />
        ) : (
          <AuthForm onSubmit={handleAuthSubmit} />
        )}
      </section>
    </main>
  );
}
