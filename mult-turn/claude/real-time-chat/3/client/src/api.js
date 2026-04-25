const SERVER_URL = 'http://localhost:3000';

async function authFetch(path, body) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export const login = (username, password) =>
  authFetch('/auth/login', { username, password });

export const register = (username, password) =>
  authFetch('/auth/register', { username, password });
