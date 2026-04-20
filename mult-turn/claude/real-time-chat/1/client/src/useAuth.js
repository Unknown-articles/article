import { useState } from 'react';

const TOKEN_KEY = 'chat_token';
const USER_KEY = 'chat_user';

function loadSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {
    // corrupted storage — treat as logged out
  }
  return null;
}

export function useAuth() {
  const [session, setSession] = useState(loadSession);

  function saveSession({ token, userId, username }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify({ userId, username }));
    setSession({ token, user: { userId, username } });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setSession(null);
  }

  return { session, saveSession, logout };
}
