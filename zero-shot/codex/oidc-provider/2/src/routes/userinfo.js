import { Router } from 'express';
import { asyncHandler, jsonError } from '../errors.js';
import { findAccessToken, scopeIncludes } from '../services/oauth.js';

export const userinfoRouter = Router();

userinfoRouter.get('/userinfo', asyncHandler(async (req, res) => {
  const token = parseBearerToken(req.get('authorization'));
  if (!token) {
    return jsonError(res, 401, 'invalid_token');
  }

  const record = await findAccessToken(token);
  const now = Math.floor(Date.now() / 1000);
  if (!record || record.expires_at <= now) {
    return jsonError(res, 401, 'invalid_token');
  }

  const claims = {
    sub: String(record.user_id)
  };

  if (scopeIncludes(record.scope, 'email')) {
    claims.email = record.email;
  }

  if (scopeIncludes(record.scope, 'profile')) {
    claims.name = record.name;
  }

  return res.json(claims);
}));

userinfoRouter.post('/userinfo', (req, res) => {
  res.set('Allow', 'GET');
  return jsonError(res, 405, 'method_not_allowed');
});

function parseBearerToken(header) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}
