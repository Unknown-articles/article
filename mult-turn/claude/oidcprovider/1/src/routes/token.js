import { createHash, createSign, randomBytes } from 'crypto';
import { Router } from 'express';
import db from '../db.js';
import { getPrivateKey, getKid } from '../keys.js';

const router = Router();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function parseClientCredentials(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon !== -1) {
      return {
        clientId: decoded.slice(0, colon),
        clientSecret: decoded.slice(colon + 1),
      };
    }
  }

  const { client_id, client_secret } = req.body;
  if (client_id) {
    return { clientId: client_id, clientSecret: client_secret };
  }

  return null;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJwt(header, payload, privateKeyPem) {
  const h = base64url(Buffer.from(JSON.stringify(header)));
  const p = base64url(Buffer.from(JSON.stringify(payload)));
  const signing_input = `${h}.${p}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signing_input);
  const sig = sign.sign(privateKeyPem, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${signing_input}.${sig}`;
}

router.post('/oauth2/token', async (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  // --- Client authentication ---
  const credentials = parseClientCredentials(req);
  if (!credentials) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await dbGet(
    'SELECT * FROM clients WHERE client_id = ?',
    [credentials.clientId]
  );
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (client.client_secret !== credentials.clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // --- Request parameter validation ---
  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  if (!code) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  // --- Authorization code validation ---
  const authCode = await dbGet(
    'SELECT * FROM auth_codes WHERE code = ?',
    [code]
  );

  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCode.used) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCode.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCode.client_id !== credentials.clientId) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // --- PKCE verification ---
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const digest = createHash('sha256').update(code_verifier).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (digest !== authCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  // --- Mark code used immediately (replay prevention) ---
  await dbRun('UPDATE auth_codes SET used = 1 WHERE id = ?', [authCode.id]);

  // --- Issue tokens ---
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;

  const accessToken = randomBytes(32).toString('hex');
  await dbRun(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [accessToken, authCode.client_id, authCode.user_id, authCode.scope, expiresAt]
  );

  const issuer = `${req.protocol}://${req.get('host')}`;
  const idToken = signJwt(
    { alg: 'RS256', kid: getKid() },
    {
      sub: String(authCode.user_id),
      iss: issuer,
      aud: authCode.client_id,
      exp: expiresAt,
      iat: now,
    },
    getPrivateKey()
  );

  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    access_token: accessToken,
    id_token:     idToken,
    token_type:   'Bearer',
    expires_in:   3600,
  });
});

export default router;
