const API_BASE_URL = 'http://localhost:3000';

export async function submitAuthRequest(mode, credentials) {
  const routeByMode = {
    register: '/auth/register',
    login: '/auth/login'
  };
  const response = await fetch(`${API_BASE_URL}${routeByMode[mode]}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'Authentication failed');
  }

  return body;
}
