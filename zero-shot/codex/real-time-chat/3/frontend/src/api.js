const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function authenticate(mode, credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Authentication failed');
  }

  return data;
}
