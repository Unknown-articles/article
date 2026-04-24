import { createHash, createSign, randomBytes } from 'crypto';
import { Router } from 'express';
import store from '../db.js';
import { getPrivKeyPem, getKeyIdentifier } from '../keys.js';

const routerInstance = Router();

function findOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    store.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    store.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function parseBasicAuth(req) {
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

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateJwt(header, payload, privKeyPem) {
  const h = b64url(Buffer.from(JSON.stringify(header)));
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const signing_input = `${h}.${p}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signing_input);
  const sig = sign.sign(privKeyPem, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${signing_input}.${sig}`;
}

routerInstance.post('/oauth2/token', async (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  // --- Client authentication ---
  const parsedCredentials = parseBasicAuth(req);
  if (!parsedCredentials) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await findOne(
    'SELECT * FROM clients WHERE client_id = ?',
    [parsedCredentials.clientId]
  );
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (client.client_secret !== parsedCredentials.clientSecret) {
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
  const storedCode = await findOne(
    'SELECT * FROM auth_codes WHERE code = ?',
    [code]
  );

  if (!storedCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (storedCode.used) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (storedCode.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (storedCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (storedCode.client_id !== parsedCredentials.clientId) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // --- PKCE verification ---
  if (storedCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const digest = createHash('sha256').update(code_verifier).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (digest !== storedCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  // --- Mark code used immediately (replay prevention) ---
  await runQuery('UPDATE auth_codes SET used = 1 WHERE id = ?', [storedCode.id]);

  // --- Issue tokens ---
  const epochNow = Math.floor(Date.now() / 1000);
  const tokenExpiry = epochNow + 3600;

  const bearerToken = randomBytes(32).toString('hex');
  await runQuery(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [bearerToken, storedCode.client_id, storedCode.user_id, storedCode.scope, tokenExpiry]
  );

  const iss = `${req.protocol}://${req.get('host')}`;
  const signedIdToken = generateJwt(
    { alg: 'RS256', kid: getKeyIdentifier() },
    {
      sub: String(storedCode.user_id),
      iss,
      aud: storedCode.client_id,
      exp: tokenExpiry,
      iat: epochNow,
    },
    getPrivKeyPem()
  );

  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    access_token: bearerToken,
    id_token:     signedIdToken,
    token_type:   'Bearer',
    expires_in:   3600,
  });
});

export default routerInstance;
