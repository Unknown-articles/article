const API_BASE_URL = 'http://localhost:3000';

export async function submitAuthRequest(mode, credentials) {
  const authPath = mode === 'register' ? '/auth/register' : '/auth/login';
  const response = await fetch(`${API_BASE_URL}${authPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Authentication failed');
  }

  return payload;
}
