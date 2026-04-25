import { useState } from 'react';

const AUTH_TOKEN = 'chat_token';
const AUTH_USER = 'chat_user';

function readSession() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN);
    const raw = localStorage.getItem(AUTH_USER);
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {
    // corrupted storage — treat as logged out
  }
  return null;
}

export function useSession() {
  const [userSession, setUserSession] = useState(readSession);

  function persistSession({ token, userId, username }) {
    localStorage.setItem(AUTH_TOKEN, token);
    localStorage.setItem(AUTH_USER, JSON.stringify({ userId, username }));
    setUserSession({ token, user: { userId, username } });
  }

  function signOut() {
    localStorage.removeItem(AUTH_TOKEN);
    localStorage.removeItem(AUTH_USER);
    setUserSession(null);
  }

  return { userSession, persistSession, signOut };
}
