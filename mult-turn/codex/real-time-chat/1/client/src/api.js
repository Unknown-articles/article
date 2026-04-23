const API_BASE_URL = 'http://localhost:3000';

export async function submitAuthRequest(mode, credentials) {
  const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Authentication failed');
  }

  return data;
}
