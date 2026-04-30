import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { initDb, get, run } from './db.js';
import { getJwks, getPrivateKey, getKeyId } from './keys.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/.well-known/openid-configuration', (req, res) => {
  const issuer = `http://localhost:${PORT}`;
  
  res.json({
    issuer: issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"]
  });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJwks());
});

app.get('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id) return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is missing' });
  if (response_type !== 'code') return res.status(400).json({ error: 'invalid_request', error_description: 'unsupported response_type' });
  if (!scope || !scope.split(' ').includes('openid')) return res.status(400).json({ error: 'invalid_request', error_description: 'invalid scope' });

  const client = await get('SELECT * FROM clients WHERE client_id = ?', [client_id]);
  if (!client) return res.status(400).json({ error: 'invalid_request', error_description: 'invalid client_id' });

  const validUris = JSON.parse(client.redirect_uris);
  if (!redirect_uri || !validUris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'invalid redirect_uri' });
  }

  res.render('login', {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method
  });
});

app.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, username, password } = req.body;

  const user = await get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  
  if (!user) {
    return res.render('login', {
      error: 'Invalid username or password',
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      code_challenge,
      code_challenge_method
    });
  }

  const code = crypto.randomBytes(16).toString('hex');
  const expires_at = Date.now() + 10 * 60 * 1000;

  await run(`
    INSERT INTO authorization_codes (code, client_id, redirect_uri, user_id, scope, code_challenge, code_challenge_method, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [code, client_id, redirect_uri, user.id, scope, code_challenge || null, code_challenge_method || null, expires_at]);

  let redirectUrl = `${redirect_uri}?code=${code}`;
  if (state) {
    redirectUrl += `&state=${encodeURIComponent(state)}`;
  }

  res.redirect(302, redirectUrl);
});

app.post('/oauth2/token', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  let { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [basicClientId, basicClientSecret] = credentials.split(':');
    client_id = basicClientId;
    client_secret = basicClientSecret;
  }

  if (!grant_type || !code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!client_id) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await get('SELECT * FROM clients WHERE client_id = ? AND client_secret = ?', [client_id, client_secret]);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const authCode = await get('SELECT * FROM authorization_codes WHERE code = ?', [code]);
  
  if (!authCode || authCode.used === 1 || authCode.expires_at < Date.now() || authCode.redirect_uri !== redirect_uri || authCode.client_id !== client_id) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (hash !== authCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  await run('UPDATE authorization_codes SET used = 1 WHERE id = ?', [authCode.id]);

  const user = await get('SELECT * FROM users WHERE id = ?', [authCode.user_id]);

  const accessToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = 3600;

  await run(`
    INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `, [accessToken, client_id, user.id, authCode.scope, Date.now() + expiresIn * 1000]);

  const payload = {
    sub: user.username, // Using username as sub, or we could use user.id. The user requirement says "same identifier as in id_token", let's use user.username as it is more standard for simple apps.
    iss: `http://localhost:${PORT}`,
    aud: client_id,
  };

  const idToken = jwt.sign(payload, getPrivateKey(), {
    algorithm: 'RS256',
    keyid: getKeyId(),
    expiresIn: expiresIn
  });

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: expiresIn
  });
});

app.all('/userinfo', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const accessToken = authHeader.split(' ')[1];

  const token = await get('SELECT * FROM tokens WHERE access_token = ?', [accessToken]);
  if (!token || token.expires_at < Date.now()) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const user = await get('SELECT * FROM users WHERE id = ?', [token.user_id]);
  if (!user) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const response = {
    sub: user.username
  };

  if (token.scope && token.scope.split(' ').includes('email')) {
    response.email = user.email;
  }

  res.json(response);
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`OIDC Provider running on port ${PORT}`);
});
