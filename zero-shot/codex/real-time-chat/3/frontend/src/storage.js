const TOKEN_KEY = 'chat_token';
const USER_KEY = 'chat_user';

export function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function saveSession({ token, userId, username }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ userId, username }));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
