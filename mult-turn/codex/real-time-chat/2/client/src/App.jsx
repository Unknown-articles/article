import { useRef, useState } from 'react';
import { submitAuthRequest } from './api.js';
import { AuthForm } from './components/AuthForm.jsx';
import { ChatView } from './components/ChatView.jsx';

const TOKEN_CACHE_KEY = 'chat_token';
const USER_CACHE_KEY = 'chat_user';

function loadCachedSession() {
  const token = localStorage.getItem(TOKEN_CACHE_KEY);
  const savedUser = localStorage.getItem(USER_CACHE_KEY);

  if (!token || !savedUser) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(savedUser)
    };
  } catch {
    localStorage.removeItem(TOKEN_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    return null;
  }
}

export function App() {
  const restoredSession = loadCachedSession();
  const activeSocketRef = useRef(null);
  const [token, setToken] = useState(restoredSession?.token ?? null);
  const [user, setUser] = useState(restoredSession?.user ?? null);

  async function handleAuthSubmit(mode, credentials) {
    const sessionPayload = await submitAuthRequest(mode, credentials);
    const accountProfile = {
      userId: sessionPayload.userId,
      username: sessionPayload.username
    };

    localStorage.setItem(TOKEN_CACHE_KEY, sessionPayload.token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(accountProfile));
    setToken(sessionPayload.token);
    setUser(accountProfile);
  }

  function clearSessionState() {
    localStorage.removeItem(TOKEN_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);

    if (activeSocketRef.current) {
      activeSocketRef.current.close();
      activeSocketRef.current = null;
    }

    setToken(null);
    setUser(null);
  }

  function handleLogout() {
    clearSessionState();
  }

  function handleAuthClose() {
    clearSessionState();
  }

  return (
    <main className="app-shell">
      <section className={token && user ? 'chat-layout' : 'auth-layout'} aria-label="Real-Time Chat">
        <div className="brand-panel">
          <p className="eyebrow">Pulse Chat</p>
          <h1>Enter and keep every exchange flowing in real time.</h1>
          <p>
            This variation keeps the same live chat stack, but with a refreshed
            voice and a different internal structure.
          </p>
        </div>
        {token && user ? (
          <ChatView
            onAuthClose={handleAuthClose}
            onLogout={handleLogout}
            socketRef={activeSocketRef}
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
