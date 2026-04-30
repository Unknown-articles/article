import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getClient, getAuthCode, markAuthCodeAsUsed, saveToken, getUserById } from '../db.js';
import { getCurrentKey } from '../keys.js';

const router = express.Router();

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

router.post('/oauth2/token', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  let clientId, clientSecret;

  // Extract client credentials from Basic Auth or Body
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const b64 = authHeader.split(' ')[1];
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    [clientId, clientSecret] = decoded.split(':');
  } else {
    clientId = req.body.client_id;
    clientSecret = req.body.client_secret;
  }

  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  if (!grant_type || !code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await getClient(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const authCode = await getAuthCode(code);
  if (!authCode || authCode.used === 1 || authCode.expires_at < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // Verify PKCE if present
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    if (authCode.code_challenge_method === 'S256') {
      const hash = crypto.createHash('sha256').update(code_verifier).digest();
      const expectedChallenge = base64url(hash);

      if (expectedChallenge !== authCode.code_challenge) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
    } else {
      // plain method
      if (code_verifier !== authCode.code_challenge) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
    }
  }

  // Mark as used
  await markAuthCodeAsUsed(code);

  // Generate tokens
  const user = await getUserById(authCode.user_id);
  const accessToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = 3600; // 1 hour

  await saveToken(accessToken, clientId, user.id, authCode.scope, Date.now() + expiresIn * 1000);

  const currentKey = getCurrentKey();
  const issuer = `http://localhost:${process.env.PORT || 4000}`; // Use same issuer logic

  const idToken = jwt.sign(
    {
      sub: user.username,
      iss: issuer,
      aud: clientId,
    },
    currentKey.privateKey,
    {
      algorithm: 'RS256',
      keyid: currentKey.kid,
      expiresIn: expiresIn
    }
  );

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: expiresIn
  });
});

export default router;
