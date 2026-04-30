import crypto from 'node:crypto';
import { Router } from 'express';
import { asyncHandler, jsonError } from '../errors.js';
import {
  createAccessToken,
  createIdToken,
  findAuthorizationCode,
  findClient,
  markAuthorizationCodeUsed,
  pkceS256Challenge
} from '../services/oauth.js';

export const tokenRouter = Router();

tokenRouter.post('/oauth2/token', asyncHandler(async (req, res) => {
  const { grant_type: grantType, code, redirect_uri: redirectUri } = req.body;

  if (!grantType || !code || !redirectUri) {
    return jsonError(res, 400, 'invalid_request');
  }

  if (grantType !== 'authorization_code') {
    return jsonError(res, 400, 'unsupported_grant_type');
  }

  const credentials = getClientCredentials(req);
  if (!credentials.clientId) {
    return jsonError(res, 401, 'invalid_client');
  }

  const client = await findClient(credentials.clientId);
  if (!client || !credentials.clientSecret || !constantTimeEquals(client.client_secret, credentials.clientSecret)) {
    return jsonError(res, 401, 'invalid_client');
  }

  const authorizationCode = await findAuthorizationCode(code);
  const now = Math.floor(Date.now() / 1000);
  if (!authorizationCode || authorizationCode.used_at || authorizationCode.expires_at <= now) {
    return jsonError(res, 400, 'invalid_grant');
  }

  if (authorizationCode.client_id !== credentials.clientId || authorizationCode.redirect_uri !== redirectUri) {
    return jsonError(res, 400, 'invalid_grant');
  }

  if (authorizationCode.code_challenge) {
    if (authorizationCode.code_challenge_method !== 'S256') {
      return jsonError(res, 400, 'invalid_grant');
    }
    const expectedChallenge = pkceS256Challenge(req.body.code_verifier);
    if (!constantTimeEquals(authorizationCode.code_challenge, expectedChallenge)) {
      return jsonError(res, 400, 'invalid_grant');
    }
  }

  const update = await markAuthorizationCodeUsed(code);
  if (update.changes !== 1) {
    return jsonError(res, 400, 'invalid_grant');
  }

  const { accessToken, expiresIn } = await createAccessToken({
    clientId: authorizationCode.client_id,
    userId: authorizationCode.user_id,
    scope: authorizationCode.scope
  });
  const idToken = await createIdToken({
    clientId: authorizationCode.client_id,
    userId: authorizationCode.user_id
  });

  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  return res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: expiresIn
  });
}));

function getClientCredentials(req) {
  const basicCredentials = parseBasicAuth(req.get('authorization'));
  if (basicCredentials) {
    return basicCredentials;
  }

  return {
    clientId: req.body.client_id,
    clientSecret: req.body.client_secret
  };
}

function parseBasicAuth(header) {
  if (!header) {
    return null;
  }

  const [scheme, credentials] = header.split(/\s+/, 2);
  if (scheme !== 'Basic' || !credentials) {
    return null;
  }

  const decoded = Buffer.from(credentials, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) {
    return null;
  }

  return {
    clientId: decoded.slice(0, separator),
    clientSecret: decoded.slice(separator + 1)
  };
}

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
