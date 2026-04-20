import { Router } from 'express';
import express from 'express';
import { createHash, randomBytes, generateKeyPairSync, createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/sqliteDb.js';
import { config } from '../config.js';
import { validateToken } from '../middleware/auth.js';

const router = Router();

// ─── RSA key pair (generated once at startup) ─────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const keyId = uuidv4();

function getJwk() {
  const pubKey = createPublicKey(publicKey);
  const jwk = pubKey.export({ format: 'jwk' });
  return { ...jwk, kid: keyId, use: 'sig', alg: 'RS256' };
}

const ISSUER = config.issuer;

// ─── OIDC discovery ───────────────────────────────────────────────────────────
router.get('/.well-known/openid-configuration', (_req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth2/authorize`,
    token_endpoint: `${ISSUER}/oauth2/token`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    code_challenge_methods_supported: ['S256'],
  });
});

router.get('/.well-known/jwks.json', (_req, res) => {
  res.json({ keys: [getJwk()] });
});

// ─── User registration (non-standard, for this app) ──────────────────────────
router.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, password required' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id,username,email,password_hash) VALUES (?,?,?,?)').run(id, username, email, hash);
    res.status(201).json({ id, username, email });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: e.message });
  }
});

// ─── Authorization endpoint (returns HTML login form) ────────────────────────
router.get('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, response_type } = req.query;

  // Validate client
  const client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(client_id);
  if (!client) return res.status(400).json({ error: 'invalid_client' });

  const allowed = JSON.parse(client.redirect_uris);
  if (!allowed.includes(redirect_uri)) return res.status(400).json({ error: 'invalid_redirect_uri' });

  // Serve HTML login form
  const params = new URLSearchParams({ client_id, redirect_uri, scope: scope || 'openid', state: state || '', code_challenge: code_challenge || '', code_challenge_method: code_challenge_method || '' });
  res.send(`<!DOCTYPE html>
<html>
<head><title>Login</title>
<style>
  body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5; }
  .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.15); width: 320px; }
  h2 { margin: 0 0 1.5rem; text-align: center; }
  input { display: block; width: 100%; padding: .5rem; margin: .5rem 0 1rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
  button { width: 100%; padding: .6rem; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
  .err { color: red; font-size: .85rem; margin-bottom: .5rem; }
</style>
</head>
<body>
<div class="card">
  <h2>Sign In</h2>
  <div class="err" id="err"></div>
  <form method="POST" action="/oauth2/login">
    <input type="hidden" name="client_id" value="${client_id}">
    <input type="hidden" name="redirect_uri" value="${redirect_uri}">
    <input type="hidden" name="scope" value="${scope || 'openid'}">
    <input type="hidden" name="state" value="${state || ''}">
    <input type="hidden" name="code_challenge" value="${code_challenge || ''}">
    <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ''}">
    <label>Username or Email</label>
    <input type="text" name="login" required autofocus>
    <label>Password</label>
    <input type="password" name="password" required>
    <button type="submit">Continue</button>
  </form>
</div>
</body></html>`);
});

// ─── Login form submission ────────────────────────────────────────────────────
router.post('/oauth2/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { login, password, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.redirect(`/oauth2/authorize?${new URLSearchParams({ client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, error: 'Invalid credentials' })}`);
  }

  const code = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO authorization_codes (id,code,client_id,user_id,redirect_uri,scope,code_challenge,code_challenge_method,expires_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uuidv4(), code, client_id, user.id, redirect_uri, scope, code_challenge || null, code_challenge_method || null, expiresAt);

  const params = new URLSearchParams({ code, ...(state && { state }) });
  res.redirect(`${redirect_uri}?${params}`);
});

// ─── Token endpoint ───────────────────────────────────────────────────────────
router.post('/oauth2/token', express.json(), express.urlencoded({ extended: false }), async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });

  const authCode = db.prepare('SELECT * FROM authorization_codes WHERE code = ? AND used = 0').get(code);
  if (!authCode) return res.status(400).json({ error: 'invalid_grant' });
  if (new Date(authCode.expires_at) < new Date()) return res.status(400).json({ error: 'expired_grant' });
  if (authCode.client_id !== client_id) return res.status(400).json({ error: 'invalid_client' });
  if (authCode.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_redirect_uri' });

  // PKCE verification
  if (authCode.code_challenge) {
    if (!code_verifier) return res.status(400).json({ error: 'code_verifier required' });
    const challenge = createHash('sha256').update(code_verifier).digest('base64url');
    if (challenge !== authCode.code_challenge) return res.status(400).json({ error: 'invalid_code_verifier' });
  }

  // Mark code as used
  db.prepare('UPDATE authorization_codes SET used = 1 WHERE id = ?').run(authCode.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authCode.user_id);
  if (!user) return res.status(400).json({ error: 'user_not_found' });

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;

  // Access token (opaque, stored in DB)
  const accessToken = randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  db.prepare('INSERT INTO tokens (id,access_token,user_id,client_id,scope,expires_at) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), accessToken, user.id, client_id, authCode.scope, tokenExpiry);

  // ID token (JWT, RSA signed)
  const idToken = jwt.sign({
    sub: user.id,
    iss: ISSUER,
    aud: client_id,
    iat: now,
    exp: now + expiresIn,
    username: user.username,
    email: user.email,
    kid: keyId,
  }, privateKey, { algorithm: 'RS256' });

  res.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: expiresIn, scope: authCode.scope });
});

// ─── Userinfo endpoint ────────────────────────────────────────────────────────
router.get('/userinfo', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = auth.slice(7);

  const user = validateToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token' });

  res.json({ sub: user.id, username: user.username, email: user.email });
});

export default router;
export { privateKey, keyId, ISSUER };
