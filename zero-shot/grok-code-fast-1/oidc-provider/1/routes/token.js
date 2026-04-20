import express from 'express';
import { getClientById, getAuthCode, deleteAuthCode, saveTokens, getUserById } from '../services/auth.js';
import { signIdToken, generateRandomString, hashPKCE } from '../services/jwt.js';

const router = express.Router();

router.post('/token', async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const client = await getClientById(client_id);
  if (!client || client.client_secret !== client_secret) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  const authCode = await getAuthCode(code);
  if (!authCode || authCode.client_id !== client_id || authCode.redirect_uri !== redirect_uri || authCode.expires_at < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.code_challenge) {
    const expectedChallenge = hashPKCE(code_verifier, authCode.code_challenge_method);
    if (expectedChallenge !== authCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  await deleteAuthCode(code);

  const user = await getUserById(authCode.user_id);

  const accessToken = generateRandomString();
  const refreshToken = generateRandomString();

  const idTokenPayload = {
    iss: 'http://localhost:3000',
    sub: user.username,
    aud: client_id,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    email: user.email,
    name: user.name
  };
  const idToken = signIdToken(idTokenPayload);

  await saveTokens(accessToken, idToken, refreshToken, client_id, authCode.user_id);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
    refresh_token: refreshToken
  });
});

export default router;