import { createHash, createSign, randomBytes } from 'crypto';
import { Router } from 'express';
import database from '../db.js';
import { getSigningKey, getKeyId } from '../keys.js';

const apiRouter = Router();

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function execQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function extractCredentials(req) {
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

function encodeBase64Url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function createJwt(header, payload, privateKeyPem) {
  const h = encodeBase64Url(Buffer.from(JSON.stringify(header)));
  const p = encodeBase64Url(Buffer.from(JSON.stringify(payload)));
  const signing_input = `${h}.${p}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signing_input);
  const sig = sign.sign(privateKeyPem, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${signing_input}.${sig}`;
}

apiRouter.post('/oauth2/token', async (req, res) => {
  const { grant_type, code: authorizationCode, redirect_uri, code_verifier } = req.body;

  // --- Client authentication ---
  const clientCreds = extractCredentials(req);
  if (!clientCreds) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await queryOne(
    'SELECT * FROM clients WHERE client_id = ?',
    [clientCreds.clientId]
  );
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (client.client_secret !== clientCreds.clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // --- Request parameter validation ---
  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  if (!authorizationCode) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  // --- Authorization code validation ---
  const codeRecord = await queryOne(
    'SELECT * FROM auth_codes WHERE code = ?',
    [authorizationCode]
  );

  if (!codeRecord) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (codeRecord.used) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (codeRecord.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (codeRecord.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (codeRecord.client_id !== clientCreds.clientId) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // --- PKCE verification ---
  if (codeRecord.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const digest = createHash('sha256').update(code_verifier).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (digest !== codeRecord.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  // --- Mark code used immediately (replay prevention) ---
  await execQuery('UPDATE auth_codes SET used = 1 WHERE id = ?', [codeRecord.id]);

  // --- Issue tokens ---
  const currentTime = Math.floor(Date.now() / 1000);
  const expireTime = currentTime + 3600;

  const token = randomBytes(32).toString('hex');
  await execQuery(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [token, codeRecord.client_id, codeRecord.user_id, codeRecord.scope, expireTime]
  );

  const tokenIssuer = `${req.protocol}://${req.get('host')}`;
  const jwtToken = createJwt(
    { alg: 'RS256', kid: getKeyId() },
    {
      sub: String(codeRecord.user_id),
      iss: tokenIssuer,
      aud: codeRecord.client_id,
      exp: expireTime,
      iat: currentTime,
    },
    getSigningKey()
  );

  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    access_token: token,
    id_token:     jwtToken,
    token_type:   'Bearer',
    expires_in:   3600,
  });
});

export default apiRouter;
