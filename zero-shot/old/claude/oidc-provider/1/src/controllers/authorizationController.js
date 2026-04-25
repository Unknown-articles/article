import { getClientById, validateRedirectUri, validateScopes } from '../services/clientService.js';
import { getUserByCredentials } from '../services/userService.js';
import { createAuthCode } from '../services/authCodeService.js';

// ── HTML helpers ─────────────────────────────────────────────────────────────

function escHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function loginForm(params, errorMsg = '') {
  const hidden = [
    'client_id', 'redirect_uri', 'response_type',
    'scope', 'state', 'code_challenge', 'code_challenge_method',
  ]
    .map((k) => `<input type="hidden" name="${k}" value="${escHtml(params[k])}">`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sign In — OIDC Provider</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 1rem; }
    label { display: block; margin-top: .75rem; }
    input[type=text], input[type=password] { width: 100%; padding: .4rem; margin-top: .25rem; box-sizing: border-box; }
    button { margin-top: 1rem; padding: .5rem 1.25rem; cursor: pointer; }
    .error { color: #c00; margin-top: .75rem; }
  </style>
</head>
<body>
  <h2>Sign In</h2>
  <form method="POST" action="/oauth2/authorize">
    ${hidden}
    <label>Username<input type="text" name="username" autocomplete="username"></label>
    <label>Password<input type="password" name="password" autocomplete="current-password"></label>
    <button type="submit">Sign In</button>
    ${errorMsg ? `<p class="error">${escHtml(errorMsg)}</p>` : ''}
  </form>
</body>
</html>`;
}

// ── Shared validation ─────────────────────────────────────────────────────────

function validateOAuthParams(params) {
  const { client_id, redirect_uri, response_type, scope } = params;

  if (!client_id)      return { error: 'invalid_request', error_description: 'client_id is required' };
  if (!redirect_uri)   return { error: 'invalid_request', error_description: 'redirect_uri is required' };
  if (!response_type)  return { error: 'invalid_request', error_description: 'response_type is required' };
  if (response_type !== 'code')
    return { error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' };
  if (!scope)          return { error: 'invalid_request', error_description: 'scope is required' };
  if (!scope.split(/\s+/).includes('openid'))
    return { error: 'invalid_scope', error_description: 'openid scope is required' };

  return null;
}

function resolveClient(params, res) {
  const paramError = validateOAuthParams(params);
  if (paramError) {
    res.status(400).json(paramError);
    return null;
  }

  const client = getClientById(params.client_id);
  if (!client) {
    res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    return null;
  }

  if (!validateRedirectUri(client, params.redirect_uri)) {
    res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered for this client' });
    return null;
  }

  if (!validateScopes(client, params.scope)) {
    res.status(400).json({ error: 'invalid_scope', error_description: 'One or more requested scopes are not allowed' });
    return null;
  }

  return client;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /oauth2/authorize — show login form */
export function showAuthorizationForm(req, res) {
  const client = resolveClient(req.query, res);
  if (!client) return;
  res.send(loginForm(req.query));
}

/** POST /oauth2/authorize — process login, issue code, redirect */
export function handleAuthorization(req, res) {
  const params = req.body;
  const client = resolveClient(params, res);
  if (!client) return;

  const { username, password } = params;
  if (!username || !password) {
    return res.status(400).send(loginForm(params, 'Username and password are required.'));
  }

  const user = getUserByCredentials(username, password);
  if (!user) {
    return res.status(401).send(loginForm(params, 'Invalid username or password.'));
  }

  const code = createAuthCode({
    clientId:             params.client_id,
    userId:               user.id,
    redirectUri:          params.redirect_uri,
    scope:                params.scope,
    codeChallenge:        params.code_challenge        || null,
    codeChallengeMethod:  params.code_challenge_method || null,
  });

  const target = new URL(params.redirect_uri);
  target.searchParams.set('code', code);
  if (params.state) target.searchParams.set('state', params.state);

  res.redirect(302, target.toString());
}
