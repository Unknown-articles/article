import express from 'express';
import crypto from 'crypto';
import {
  initializeDatabase,
  findClient,
  findUserByUsername,
  findUserBySub,
  saveAuthCode,
  getAuthCode,
  markAuthCodeUsed,
  saveToken,
  findToken
} from './db.js';
import { initKeys, getJWKS, signIdToken } from './keys.js';

const PORT = process.env.PORT || 4000;
const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
const TOKEN_LIFETIME = 3600;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function jsonError(res, status, error, description) {
  return res.status(status).json({ error, error_description: description });
}

function renderLoginPage(params = {}) {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, error } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Login</title>
</head>
<body>
  <h1>Authorize Application</h1>
  ${error ? `<p style="color:red;">${error}</p>` : ''}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${escapeHtml(client_id || '')}" />
    <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || '')}" />
    <input type="hidden" name="response_type" value="${escapeHtml(response_type || '')}" />
    <input type="hidden" name="scope" value="${escapeHtml(scope || '')}" />
    <input type="hidden" name="state" value="${escapeHtml(state || '')}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}" />
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || '')}" />
    <p>
      <label>Username: <input type="text" name="username" value="${escapeHtml(params.username || '')}" required /></label>
    </p>
    <p>
      <label>Password: <input type="password" name="password" required /></label>
    </p>
    <button type="submit">Login</button>
  </form>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validateOpenIdScope(scope) {
  return typeof scope === 'string' && scope.split(' ').includes('openid');
}

function computePkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

app.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth2/authorize`,
    token_endpoint: `${ISSUER}/oauth2/token`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256']
  });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

app.get('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;
  if (!client_id) return jsonError(res, 400, 'invalid_request', 'client_id is required');
  if (!redirect_uri) return jsonError(res, 400, 'invalid_request', 'redirect_uri is required');
  if (!response_type || response_type !== 'code') return jsonError(res, 400, 'invalid_request', 'response_type must be code');
  if (!validateOpenIdScope(scope)) return jsonError(res, 400, 'invalid_request', 'scope must include openid');

  const client = await findClient(client_id);
  if (!client) return jsonError(res, 400, 'invalid_request', 'unknown client_id');
  const redirectUris = JSON.parse(client.redirect_uris);
  if (!redirectUris.includes(redirect_uri)) {
    return jsonError(res, 400, 'invalid_request', 'redirect_uri is not registered');
  }

  res.type('html').send(renderLoginPage({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method }));
});

app.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;
  if (!client_id || !redirect_uri || !response_type || response_type !== 'code' || !validateOpenIdScope(scope)) {
    return jsonError(res, 400, 'invalid_request', 'invalid authorization request');
  }
  const client = await findClient(client_id);
  if (!client) return jsonError(res, 400, 'invalid_request', 'unknown client_id');
  const redirectUris = JSON.parse(client.redirect_uris);
  if (!redirectUris.includes(redirect_uri)) {
    return jsonError(res, 400, 'invalid_request', 'redirect_uri is not registered');
  }
  const user = await findUserByUsername(username);
  if (!user || user.password !== password) {
    return res.status(200).type('html').send(renderLoginPage({
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      username,
      error: 'Invalid username or password'
    }));
  }

  const code = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await saveAuthCode({
    code,
    client_id,
    redirect_uri,
    user_sub: user.sub,
    scope,
    expires_at: now + 600_000,
    code_challenge: code_challenge || null,
    code_challenge_method: code_challenge_method || null,
    created_at: now
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  res.redirect(302, redirectUrl.toString());
});

app.post('/oauth2/token', async (req, res) => {
  const authHeader = req.headers.authorization;
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [headerClientId, headerClientSecret] = credentials.split(':');
    clientId = clientId || headerClientId;
    clientSecret = clientSecret || headerClientSecret;
  }

  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  if (!grant_type || !code || !redirect_uri) {
    return jsonError(res, 400, 'invalid_request', 'grant_type, code, and redirect_uri are required');
  }
  if (grant_type !== 'authorization_code') {
    return jsonError(res, 400, 'unsupported_grant_type', 'grant_type is not supported');
  }
  if (!clientId || !clientSecret) {
    return jsonError(res, 401, 'invalid_client', 'client authentication required');
  }
  const client = await findClient(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return jsonError(res, 401, 'invalid_client', 'invalid client credentials');
  }

  const authCode = await getAuthCode(code);
  if (!authCode || authCode.used || authCode.expires_at < Date.now()) {
    return jsonError(res, 400, 'invalid_grant', 'authorization code is invalid or expired');
  }
  if (authCode.client_id !== clientId) {
    return jsonError(res, 400, 'invalid_grant', 'authorization code does not belong to client');
  }
  if (authCode.redirect_uri !== redirect_uri) {
    return jsonError(res, 400, 'invalid_grant', 'redirect_uri does not match authorization request');
  }
  if (authCode.code_challenge) {
    if (!code_verifier || authCode.code_challenge_method !== 'S256') {
      return jsonError(res, 400, 'invalid_grant', 'PKCE verification failed');
    }
    const expected = computePkceChallenge(code_verifier);
    if (expected !== authCode.code_challenge) {
      return jsonError(res, 400, 'invalid_grant', 'PKCE verification failed');
    }
  }

  await markAuthCodeUsed(code);

  const accessToken = crypto.randomBytes(32).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TOKEN_LIFETIME;
  const idToken = await signIdToken({ sub: authCode.user_sub }, clientId, ISSUER);

  await saveToken({
    access_token: accessToken,
    client_id: clientId,
    user_sub: authCode.user_sub,
    scope: authCode.scope,
    issued_at: issuedAt,
    expires_at: expiresAt,
    id_token: idToken
  });

  res.set('Cache-Control', 'no-store');
  return res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: TOKEN_LIFETIME
  });
});

app.get('/userinfo', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError(res, 401, 'invalid_request', 'Bearer token required');
  }
  const accessToken = authHeader.slice(7);
  const token = await findToken(accessToken);
  if (!token || token.expires_at < Math.floor(Date.now() / 1000)) {
    return jsonError(res, 401, 'invalid_token', 'access token invalid or expired');
  }

  const user = await findUserBySub(token.user_sub);
  if (!user) {
    return jsonError(res, 401, 'invalid_token', 'user not found');
  }

  const response = {
    sub: user.sub,
    name: user.username
  };
  if (token.scope.split(' ').includes('email')) {
    response.email = user.email;
  }

  return res.json(response);
});

app.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
});

async function start() {
  await initializeDatabase();
  await initKeys();
  app.listen(PORT, () => {
    console.log(`OIDC Provider listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
