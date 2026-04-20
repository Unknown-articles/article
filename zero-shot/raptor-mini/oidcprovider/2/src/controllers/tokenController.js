import { findClient, consumeAuthorizationCode, createAccessToken, createIdToken, getUserById } from '../services/authService.js';

function extractClientCredentials(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [client_id, client_secret] = credentials.split(':');
    return { client_id, client_secret };
  }
  return {
    client_id: req.body.client_id,
    client_secret: req.body.client_secret
  };
}

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

export async function token(req, res) {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  if (!grant_type || !code || !redirect_uri) {
    return sendError(res, 400, 'invalid_request');
  }
  if (grant_type !== 'authorization_code') {
    return sendError(res, 400, 'unsupported_grant_type');
  }

  const { client_id, client_secret } = extractClientCredentials(req);
  if (!client_id || !client_secret) {
    return sendError(res, 401, 'invalid_client');
  }

  const client = await findClient(client_id);
  if (!client || client.client_secret !== client_secret) {
    return sendError(res, 401, 'invalid_client');
  }

  const authorizationCode = await consumeAuthorizationCode({
    code,
    client_id,
    redirect_uri,
    code_verifier
  });
  if (!authorizationCode) {
    return sendError(res, 400, 'invalid_grant');
  }

  const user = await getUserById(authorizationCode.user_id);
  if (!user) {
    return sendError(res, 400, 'invalid_grant');
  }

  const { accessToken, expiresAt } = await createAccessToken({
    client_id,
    user_id: user.id,
    scope: authorizationCode.scope
  });

  const id_token = createIdToken({
    sub: String(user.id),
    client_id,
    email: user.email,
    name: user.name
  });

  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.json({
    access_token: accessToken,
    id_token,
    token_type: 'Bearer',
    expires_in: expiresAt - Math.floor(Date.now() / 1000)
  });
}
