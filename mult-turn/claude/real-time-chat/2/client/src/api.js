const API_BASE = 'http://localhost:3000';

async function makeAuthRequest(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
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
  makeAuthRequest('/auth/login', { username, password });

export const register = (username, password) =>
  makeAuthRequest('/auth/register', { username, password });
