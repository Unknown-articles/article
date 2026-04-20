import { getClientById, validateClientSecret } from '../services/clientService.js';
import { lookupAuthCode, markCodeUsed, verifyPkce } from '../services/codeService.js';
import { generateAccessToken } from '../services/tokenService.js';
import { signIdToken, buildIdTokenPayload } from '../services/jwtService.js';
import { getUserById } from '../services/userService.js';
import { getActiveKey } from '../keys/keyManager.js';
import config from '../config/index.js';

function extractClientCredentials(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      return { clientId: decoded.slice(0, sep), clientSecret: decoded.slice(sep + 1) };
    }
  }
  return { clientId: req.body.client_id, clientSecret: req.body.client_secret };
}

export function postToken(req, res) {
  res.set('Cache-Control', 'no-store');

  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  const { clientId, clientSecret } = extractClientCredentials(req);

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'client_id is required' });
  }

  const client = getClientById(clientId);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client' });
  }

  if (clientSecret === undefined || clientSecret === null || !validateClientSecret(client, clientSecret)) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_secret' });
  }

  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type is required' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' });
  }

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
  }

  if (!redirect_uri) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
  }

  const lookup = lookupAuthCode(code);
  if (lookup.error === 'invalid') {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
  }
  if (lookup.error === 'replay') {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
  }
  if (lookup.error === 'expired') {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
  }

  const authCode = lookup.code;

  if (authCode.client_id !== clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
  }

  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier is required' });
    }
    if (!verifyPkce(authCode.code_challenge, code_verifier)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier does not match code_challenge' });
    }
  }

  markCodeUsed(code);

  const user = getUserById(authCode.user_id);
  const { token: accessToken } = generateAccessToken(clientId, user.id, authCode.scope);

  const signingKey = getActiveKey();
  const idTokenPayload = buildIdTokenPayload(user, clientId);
  const idToken = signIdToken(idTokenPayload, signingKey.private_key_pem, signingKey.kid);

  return res.status(200).json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: config.ACCESS_TOKEN_TTL,
  });
}
