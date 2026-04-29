import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { SignJWT } from 'jose';
import { getDb } from '../db/index.js';
import { getSigningKey, getActiveKeyRow } from '../keys.js';
import { ISSUER, TOKEN_TTL } from '../config.js';

const router = Router();

function parseClientAuth(req) {
  // Basic auth header
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      return { client_id: decoded.slice(0, sep), client_secret: decoded.slice(sep + 1) };
    }
  }
  return { client_id: req.body.client_id, client_secret: req.body.client_secret };
}

router.post('/oauth2/token', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  const { client_id, client_secret } = parseClientAuth(req);

  // Client auth
  if (!client_id) return res.status(401).json({ error: 'invalid_client', error_description: 'client_id required' });
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE client_id=?').get(client_id);
  if (!client) return res.status(401).json({ error: 'invalid_client', error_description: 'unknown client' });
  if (client.client_secret !== client_secret) return res.status(401).json({ error: 'invalid_client', error_description: 'bad client_secret' });

  // grant_type
  if (!grant_type) return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type required' });
  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });

  // required params
  if (!code) return res.status(400).json({ error: 'invalid_request', error_description: 'code required' });
  if (!redirect_uri) return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri required' });

  // validate code
  const now = Math.floor(Date.now() / 1000);
  const authCode = db.prepare('SELECT * FROM auth_codes WHERE code=?').get(code);
  if (!authCode || authCode.used || authCode.expires_at < now) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'invalid or expired code' });
  }
  if (authCode.client_id !== client_id) return res.status(400).json({ error: 'invalid_grant', error_description: 'client mismatch' });
  if (authCode.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });

  // PKCE
  if (authCode.code_challenge) {
    if (!code_verifier) return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
    const computed = createHash('sha256').update(code_verifier).digest('base64url');
    if (computed !== authCode.code_challenge) return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
  }

  // mark used
  db.prepare('UPDATE auth_codes SET used=1 WHERE code=?').run(code);

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(authCode.user_id);
  const access_token = randomBytes(32).toString('base64url');
  const expires_at = now + TOKEN_TTL;

  db.prepare('INSERT INTO tokens (access_token, user_id, client_id, scope, expires_at) VALUES (?,?,?,?,?)')
    .run(access_token, user.id, client_id, authCode.scope, expires_at);

  const keyRow = getActiveKeyRow();
  const signingKey = await getSigningKey();

  const id_token = await new SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'RS256', kid: keyRow.kid })
    .setIssuer(ISSUER)
    .setAudience(client_id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL)
    .sign(signingKey);

  return res.json({ access_token, id_token, token_type: 'Bearer', expires_in: TOKEN_TTL });
});

export default router;
