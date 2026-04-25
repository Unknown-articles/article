import express from 'express';
import { getClientById, saveAuthCode, getUserById } from '../services/auth.js';
import { generateRandomString, hashPKCE } from '../services/jwt.js';

const router = express.Router();

router.get('/authorize', async (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = req.query;

  if (response_type !== 'code') {
    return res.status(400).json({ error: 'invalid_request', error_description: 'response_type must be code' });
  }

  const client = await getClientById(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  if (!scope.includes('openid')) {
    return res.status(400).json({ error: 'invalid_scope' });
  }

  // Mock user authentication - assume user 1 is logged in
  const user = await getUserById(1);

  const code = generateRandomString();
  const challenge = code_challenge ? hashPKCE(code_challenge, code_challenge_method || 'plain') : null;

  await saveAuthCode(code, client_id, user.id, redirect_uri, scope, challenge, code_challenge_method || 'plain');

  const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  res.redirect(redirectUrl);
});

export default router;