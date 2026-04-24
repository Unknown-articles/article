import { useRef, useState } from 'react';
import { submitAuthRequest } from './api.js';
import { AuthForm } from './components/AuthForm.jsx';
import { ChatView } from './components/ChatView.jsx';

const SESSION_TOKEN_KEY = 'chat_token';
const SESSION_USER_KEY = 'chat_user';

function recoverSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const rawUser = localStorage.getItem(SESSION_USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser)
    };
  } catch {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    return null;
  }
}

export function App() {
  const bootSession = recoverSession();
  const socketRef = useRef(null);
  const [token, setToken] = useState(bootSession?.token ?? null);
  const [user, setUser] = useState(bootSession?.user ?? null);

  async function handleAuthSubmit(mode, credentials) {
    const responseData = await submitAuthRequest(mode, credentials);
    const nextUserState = {
      userId: responseData.userId,
      username: responseData.username
    };

    localStorage.setItem(SESSION_TOKEN_KEY, responseData.token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUserState));
    setToken(responseData.token);
    setUser(nextUserState);
  }

  function dropSession() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setToken(null);
    setUser(null);
  }

  function handleLogout() {
    dropSession();
  }

  function handleAuthClose() {
    dropSession();
  }

  return (
    <main className="app-shell">
      <section className={token && user ? 'chat-layout' : 'auth-layout'} aria-label="Real-Time Chat">
        <div className="brand-panel">
          <p className="eyebrow">Sync Room</p>
          <h1>Open the room and continue the conversation without delay.</h1>
          <p>
            Same authentication and websocket behavior, with a second visual and
            structural variation in the codebase.
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
