import { useState } from 'react';

const STORED_TOKEN = 'chat_token';
const STORED_USER = 'chat_user';

function initSession() {
  try {
    const token = localStorage.getItem(STORED_TOKEN);
    const raw = localStorage.getItem(STORED_USER);
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {
    // corrupted storage — treat as logged out
  }
  return null;
}

export function useAuthState() {
  const [authData, setAuthData] = useState(initSession);

  function storeSession({ token, userId, username }) {
    localStorage.setItem(STORED_TOKEN, token);
    localStorage.setItem(STORED_USER, JSON.stringify({ userId, username }));
    setAuthData({ token, user: { userId, username } });
  }

  function clearAuth() {
    localStorage.removeItem(STORED_TOKEN);
    localStorage.removeItem(STORED_USER);
    setAuthData(null);
  }

  return { authData, storeSession, clearAuth };
}
