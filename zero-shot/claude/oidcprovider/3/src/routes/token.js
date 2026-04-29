import { Router } from 'express';
import { createHash } from 'crypto';
import { getDb } from '../db/schema.js';
import { signIdToken, generateAccessToken } from '../lib/tokens.js';

const router = Router();

function parseClientCredentials(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      return {
        client_id: decoded.slice(0, sep),
        client_secret: decoded.slice(sep + 1),
      };
    }
  }
  return {
    client_id: req.body.client_id,
    client_secret: req.body.client_secret,
  };
}

function base64urlNoPad(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function verifyPkce(verifier, challenge, method) {
  if (method === 'S256') {
    const computed = base64urlNoPad(createHash('sha256').update(verifier).digest());
    return computed === challenge;
  }
  return verifier === challenge;
}

router.post('/oauth2/token', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  const { client_id, client_secret } = parseClientCredentials(req);

  // Client authentication
  if (!client_id) return res.status(401).json({ error: 'invalid_client', error_description: 'client_id required' });

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(client_id);
  if (!client) return res.status(401).json({ error: 'invalid_client', error_description: 'unknown client' });
  if (client.client_secret !== client_secret) return res.status(401).json({ error: 'invalid_client', error_description: 'invalid client_secret' });

  // grant_type
  if (!grant_type) return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type required' });
  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });

  if (!code) return res.status(400).json({ error: 'invalid_request', error_description: 'code required' });
  if (!redirect_uri) return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri required' });

  const now = Math.floor(Date.now() / 1000);
  const authCode = db.prepare('SELECT * FROM authorization_codes WHERE code = ?').get(code);

  if (!authCode) return res.status(400).json({ error: 'invalid_grant', error_description: 'unknown code' });
  if (authCode.used) return res.status(400).json({ error: 'invalid_grant', error_description: 'code already used' });
  if (authCode.expires_at < now) return res.status(400).json({ error: 'invalid_grant', error_description: 'code expired' });
  if (authCode.client_id !== client_id) return res.status(400).json({ error: 'invalid_grant', error_description: 'client mismatch' });
  if (authCode.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });

  // PKCE verification
  if (authCode.code_challenge) {
    if (!code_verifier) return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
    if (!verifyPkce(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier mismatch' });
    }
  }

  // Mark code as used
  db.prepare('UPDATE authorization_codes SET used = 1 WHERE id = ?').run(authCode.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authCode.user_id);
  const scope = authCode.scope;
  const scopes = scope.split(' ');

  const extraClaims = {};
  if (scopes.includes('email')) extraClaims.email = user.email;
  if (scopes.includes('profile')) extraClaims.name = user.name;

  const idToken = await signIdToken({ sub: String(user.id), clientId: client_id, scope, extraClaims });
  const { token: accessToken, expiresAt } = generateAccessToken({ clientId: client_id, userId: user.id, scope });

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: expiresAt - now,
  });
});

export default router;
