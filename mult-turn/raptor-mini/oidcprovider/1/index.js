import express from 'express';
import { createHash, createSign, randomBytes } from 'crypto';
import {
  initializeDatabase,
  getClientById,
  getUserByUsername,
  getUserById,
  insertAuthCode,
  getAuthCode,
  markAuthCodeUsed,
  insertToken,
  getTokenByAccessToken,
} from './db.js';
import { initializeKeys } from './keys.js';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const { privateKey, kid, jwks } = initializeKeys();

const base64Url = (buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const signJwt = ({ header, payload }) => {
  const encodedHeader = base64Url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64Url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKey);
  return `${signingInput}.${base64Url(signature)}`;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseBasicAuth = (authorization) => {
  if (!authorization || !authorization.startsWith('Basic ')) {
    return null;
  }

  const encoded = authorization.slice(6).trim();
  if (!encoded) {
    return null;
  }

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex < 0) {
    return null;
  }

  return {
    client_id: decoded.slice(0, colonIndex),
    client_secret: decoded.slice(colonIndex + 1),
  };
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.set('Content-Type', 'application/json');
    return originalJson(body);
  };
  next();
});

const renderLoginForm = ({
  client_id = '',
  redirect_uri = '',
  response_type = 'code',
  scope = '',
  state = '',
  code_challenge = '',
  code_challenge_method = '',
}, error) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Login</title>
</head>
<body>
  <h1>Sign In</h1>
  ${error ? `<div style="color: red;">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${escapeHtml(client_id)}" />
    <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}" />
    <input type="hidden" name="state" value="${escapeHtml(state || '')}" />
    <input type="hidden" name="response_type" value="${escapeHtml(response_type)}" />
    <input type="hidden" name="scope" value="${escapeHtml(scope)}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}" />
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method)}" />

    <div>
      <label for="username">Username</label>
      <input id="username" name="username" type="text" required />
    </div>
    <div>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
    </div>
    <div>
      <button type="submit">Sign In</button>
    </div>
  </form>
</body>
</html>`;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/oauth2/authorize', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  const client = await getClientById(client_id);
  if (!client) {
    return res.status(400).json({ error: 'invalid client_id' });
  }

  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  let redirectUris;
  try {
    redirectUris = JSON.parse(client.redirect_uris);
  } catch {
    redirectUris = [];
  }

  if (!Array.isArray(redirectUris) || !redirectUris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'redirect_uri is not registered' });
  }

  if (!response_type || response_type !== 'code') {
    return res.status(400).json({ error: 'response_type must be code' });
  }

  if (!scope || !String(scope).split(/\s+/).includes('openid')) {
    return res.status(400).json({ error: 'scope must include openid' });
  }

  res.type('html').send(
    renderLoginForm(
      {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method,
      }
    )
  );
});

app.post('/oauth2/authorize', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    username,
    password,
    code_challenge,
    code_challenge_method,
  } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  const client = await getClientById(client_id);
  if (!client) {
    return res.status(400).json({ error: 'invalid client_id' });
  }

  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  let redirectUris;
  try {
    redirectUris = JSON.parse(client.redirect_uris);
  } catch {
    redirectUris = [];
  }

  if (!Array.isArray(redirectUris) || !redirectUris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'redirect_uri is not registered' });
  }

  if (!response_type || response_type !== 'code') {
    return res.status(400).json({ error: 'response_type must be code' });
  }

  if (!scope || !String(scope).split(/\s+/).includes('openid')) {
    return res.status(400).json({ error: 'scope must include openid' });
  }

  const user = await getUserByUsername(username);
  if (!user || user.password !== password) {
    return res.type('html').send(
      renderLoginForm(
        {
          client_id,
          redirect_uri,
          response_type,
          scope,
          state,
          code_challenge,
          code_challenge_method,
        },
        'Invalid username or password'
      )
    );
  }

  const code = randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  await insertAuthCode({
    code,
    clientId: client_id,
    userId: user.id,
    redirectUri: redirect_uri,
    scope,
    codeChallenge: code_challenge || null,
    codeChallengeMethod: code_challenge_method || null,
    expiresAt,
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  res.redirect(302, redirectUrl.toString());
});

app.post('/oauth2/token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const {
    grant_type,
    code,
    redirect_uri,
    client_id: bodyClientId,
    client_secret: bodyClientSecret,
    code_verifier,
  } = req.body;

  if (!grant_type || !code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const auth = parseBasicAuth(req.header('authorization'));
  const clientId = auth?.client_id || bodyClientId;
  const clientSecret = auth?.client_secret || bodyClientSecret;

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await getClientById(clientId);
  if (!client || !clientSecret || clientSecret !== client.client_secret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const authCode = await getAuthCode(code);
  if (
    !authCode ||
    authCode.used === 1 ||
    authCode.expires_at < Math.floor(Date.now() / 1000) ||
    authCode.redirect_uri !== redirect_uri ||
    authCode.client_id !== clientId
  ) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const digest = createHash('sha256').update(code_verifier).digest();
    const transformed = base64Url(digest);
    if (transformed !== authCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  await markAuthCodeUsed(code);

  const accessToken = randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const accessExpiresAt = now + 3600;

  await insertToken({
    accessToken,
    clientId,
    userId: authCode.user_id,
    scope: authCode.scope,
    expiresAt: accessExpiresAt,
  });

  const issuer = `${req.protocol}://${req.get('host')}`;
  const idToken = signJwt({
    header: {
      alg: 'RS256',
      kid,
    },
    payload: {
      sub: String(authCode.user_id),
      iss: issuer,
      aud: clientId,
      exp: now + 3600,
      iat: now,
    },
  });

  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

app.get('/userinfo', async (req, res) => {
  const authorization = req.header('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const accessToken = authorization.slice(7).trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = await getTokenByAccessToken(accessToken);
  if (!token || token.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const user = await getUserById(token.user_id);
  if (!user) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const response = {
    sub: String(user.id),
  };
  if (String(token.scope).split(/\s+/).includes('email')) {
    response.email = user.email;
  }

  res.status(200).json(response);
});

app.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json(jwks);
});

const start = async () => {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
