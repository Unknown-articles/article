import { validateAuthCode, createTokens, verifyPKCE } from '../services/auth.js';
import { getClientById } from '../models/db.js';

function parseBasicAuth(authHeader) {
  const base64 = authHeader.split(' ')[1];
  const [clientId, clientSecret] = Buffer.from(base64, 'base64').toString().split(':');
  return { clientId, clientSecret };
}

export async function postToken(req, res) {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

  let clientId = client_id;
  let clientSecret = client_secret;

  if (req.headers.authorization && req.headers.authorization.startsWith('Basic ')) {
    const auth = parseBasicAuth(req.headers.authorization);
    clientId = auth.clientId;
    clientSecret = auth.clientSecret;
  }

  if (!grant_type || grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const client = await getClientById(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const authCode = await validateAuthCode(code, clientId, redirect_uri);
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.code_challenge && !verifyPKCE(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  const { accessToken, idToken } = await createTokens(clientId, authCode.user_id, authCode.scope);

  res.set('Cache-Control', 'no-store');
  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600
  });
}