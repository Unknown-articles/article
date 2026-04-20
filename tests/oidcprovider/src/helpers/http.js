export const BASE_URL = 'http://localhost:3000';

/**
 * GET request helper. Returns { status, headers, body } where body is parsed JSON (or raw text).
 */
export async function get(path, { headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers, redirect: 'manual' });
  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  return { status: res.status, headers: res.headers, body };
}

/**
 * POST with application/x-www-form-urlencoded body.
 */
export async function postForm(path, params, { headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
    redirect: 'manual',
  });
  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  return { status: res.status, headers: res.headers, body };
}

/**
 * Build the authorization URL (does NOT follow redirects).
 */
export function buildAuthorizeUrl(params) {
  const qs = new URLSearchParams(params).toString();
  return `${BASE_URL}/oauth2/authorize?${qs}`;
}

/**
 * Encode client credentials as HTTP Basic.
 */
export function basicAuth(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Perform the full browser-simulated POST /oauth2/authorize and return the redirect location.
 * Does NOT follow the redirect — returns the code and state from the Location header.
 */
export async function loginAndGetCode({ client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, username, password }) {
  const res = await fetch(`${BASE_URL}/oauth2/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      redirect_uri,
      response_type: 'code',
      scope,
      state: state ?? '',
      code_challenge: code_challenge ?? '',
      code_challenge_method: code_challenge_method ?? '',
      username,
      password,
    }).toString(),
    redirect: 'manual',
  });

  const location = res.headers.get('location');
  if (!location) {
    const text = await res.text();
    throw new Error(`Expected redirect but got ${res.status}. Body: ${text.slice(0, 500)}`);
  }

  const url = new URL(location);
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    location,
    status: res.status,
  };
}
