import { getClientById } from '../services/clientService.js';
import { getAuthCode, consumeAuthCode, validatePKCE } from '../services/authCodeService.js';
import { createTokens } from '../services/tokenService.js';
import { getUserById } from '../services/userService.js';

/** Resolve client credentials from body or HTTP Basic auth header. */
function resolveClientCredentials(req) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon !== -1) {
      return { clientId: decoded.slice(0, colon), clientSecret: decoded.slice(colon + 1) };
    }
  }

  return { clientId: req.body.client_id, clientSecret: req.body.client_secret };
}

/** POST /oauth2/token */
export async function issueToken(req, res) {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type is required' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only grant_type=authorization_code is supported',
    });
  }

  if (!code)         return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
  if (!redirect_uri) return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });

  // Authenticate the client
  const { clientId, clientSecret } = resolveClientCredentials(req);

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'client_id is required' });
  }

  const client = getClientById(clientId);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client' });
  }

  if (client.client_secret !== clientSecret) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client secret' });
  }

  // Validate the authorization code
  const authCode = getAuthCode(code);
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code not found' });
  }

  if (authCode.used) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (authCode.expires_at < now) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
  }

  if (authCode.client_id !== clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
  }

  // Validate PKCE
  if (!validatePKCE(authCode.code_challenge, authCode.code_challenge_method, code_verifier)) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
  }

  // Mark code as used before issuing tokens (prevents replay)
  consumeAuthCode(code);

  const user = getUserById(authCode.user_id);
  if (!user) {
    return res.status(500).json({ error: 'server_error', error_description: 'User not found' });
  }

  try {
    const tokens = await createTokens({
      clientId,
      userId: user.id,
      scope:  authCode.scope,
      user,
    });

    res.set('Cache-Control', 'no-store');
    res.json(tokens);
  } catch (err) {
    console.error('Token issuance error:', err);
    res.status(500).json({ error: 'server_error', error_description: 'Failed to issue tokens' });
  }
}
