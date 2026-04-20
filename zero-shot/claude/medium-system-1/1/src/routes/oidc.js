import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  getDiscovery,
  getJWKS,
  getClientById,
  getUserByEmail,
  createAuthCode,
  consumeAuthCode,
  verifyPKCE,
  createTokens,
  validateAccessToken
} from '../services/oidcService.js';

const router = Router();

// ─── Discovery ────────────────────────────────────────────────────────────────

router.get('/.well-known/openid-configuration', (req, res) => {
  res.json(getDiscovery());
});

// ─── JWKS ─────────────────────────────────────────────────────────────────────

router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

// ─── Authorization — GET: render login form ───────────────────────────────────

router.get('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id)
    return res.status(400).json({ error: 'invalid_request', message: 'client_id required' });
  if (response_type !== 'code')
    return res.status(400).json({ error: 'unsupported_response_type', message: 'Only code flow is supported' });
  if (!scope || !scope.includes('openid'))
    return res.status(400).json({ error: 'invalid_scope', message: 'openid scope required' });

  const client = getClientById(client_id);
  if (!client)
    return res.status(400).json({ error: 'invalid_client', message: 'Unknown client_id' });
  if (client.redirect_uri !== redirect_uri)
    return res.status(400).json({ error: 'invalid_request', message: 'redirect_uri mismatch' });

  // Embed all OAuth params in the form action so POST receives them as query
  const qs = new URLSearchParams(req.query).toString();
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sign in — Unified Backend</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center;
           padding: 60px 20px; background: #f5f5f5; }
    form { background: #fff; padding: 32px 40px; border-radius: 8px;
           box-shadow: 0 2px 8px rgba(0,0,0,.12); min-width: 320px; }
    h2   { margin-top: 0; font-size: 1.4rem; }
    label { display: block; margin: 14px 0 4px; font-size: .9rem; color: #555; }
    input { width: 100%; box-sizing: border-box; padding: 8px 10px;
            border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    button { margin-top: 20px; width: 100%; padding: 10px; background: #4f46e5;
             color: #fff; border: none; border-radius: 4px; font-size: 1rem;
             cursor: pointer; }
    button:hover { background: #4338ca; }
  </style>
</head>
<body>
  <form method="POST" action="/oauth2/authorize?${qs}">
    <h2>Sign In</h2>
    <label>Email</label>
    <input type="email" name="email" required autofocus />
    <label>Password</label>
    <input type="password" name="password" required />
    <button type="submit">Continue</button>
  </form>
</body>
</html>`);
});

// ─── Authorization — POST: authenticate → redirect with code ─────────────────

router.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, state, code_challenge } = req.query;
  const { email, password } = req.body;

  const client = getClientById(client_id);
  if (!client || client.redirect_uri !== redirect_uri)
    return res.status(400).json({ error: 'invalid_client', message: 'Invalid client or redirect_uri' });

  const user = getUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const qs = new URLSearchParams(req.query).toString();
    return res.status(401).send(`<p style="color:red">Invalid credentials. <a href="/oauth2/authorize?${qs}">Try again</a></p>`);
  }

  const scope = req.query.scope || 'openid';
  const code  = createAuthCode(client_id, user.id, code_challenge, scope);

  const dest = new URL(redirect_uri);
  dest.searchParams.set('code', code);
  if (state) dest.searchParams.set('state', state);

  res.redirect(dest.toString());
});

// ─── UserInfo endpoint ────────────────────────────────────────────────────────

router.get('/userinfo', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });

  const user = validateAccessToken(header.slice(7));
  if (!user)
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });

  res.json({ sub: user.id, email: user.email, role: user.role });
});

// ─── Token endpoint ───────────────────────────────────────────────────────────

router.post('/oauth2/token', async (req, res) => {
  const { grant_type, code, code_verifier, client_id } = req.body;

  if (grant_type !== 'authorization_code')
    return res.status(400).json({ error: 'unsupported_grant_type', message: 'Only authorization_code is supported' });
  if (!code)
    return res.status(400).json({ error: 'invalid_request', message: 'code is required' });

  const authCode = consumeAuthCode(code);
  if (!authCode)
    return res.status(400).json({ error: 'invalid_grant', message: 'Code is invalid or expired' });

  // client_id in body must match if provided
  if (client_id && authCode.client_id !== client_id)
    return res.status(400).json({ error: 'invalid_grant', message: 'client_id mismatch' });

  // PKCE verification — required when a challenge was stored
  if (authCode.code_challenge) {
    if (!code_verifier)
      return res.status(400).json({ error: 'invalid_request', message: 'code_verifier required (PKCE)' });
    if (!verifyPKCE(code_verifier, authCode.code_challenge))
      return res.status(400).json({ error: 'invalid_grant', message: 'PKCE verification failed' });
  }

  const tokens = createTokens(authCode.user_id, authCode.client_id, authCode.scope);
  res.json(tokens);
});

export default router;
