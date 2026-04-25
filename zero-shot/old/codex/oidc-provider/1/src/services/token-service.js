import crypto from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { consumeAuthorizationCode, findAuthorizationCode } from './authorization-service.js';
import { findClientById } from './client-service.js';
import { findUserById } from './user-service.js';
import { getActivePrivateKey } from './key-service.js';
import { getPublicKeyForToken } from './key-service.js';
import { get, run, withTransaction } from '../database/db.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { nowInSeconds, isoDateAfterSeconds } from '../utils/time.js';

const ACCESS_TOKEN_LIFETIME_SECONDS = 3600;
const ID_TOKEN_LIFETIME_SECONDS = 3600;

export async function exchangeAuthorizationCode({ database, config, requestBody }) {
  if (requestBody.grant_type !== 'authorization_code') {
    throw badRequest('unsupported_grant_type', 'Only grant_type=authorization_code is supported');
  }

  if (!requestBody.code || !requestBody.client_id || !requestBody.redirect_uri) {
    throw badRequest('invalid_request', 'code, client_id, and redirect_uri are required');
  }

  const client = await findClientById(database, requestBody.client_id);
  if (!client) {
    throw badRequest('invalid_client', 'Unknown client_id');
  }

  if (requestBody.client_secret && client.clientSecret && requestBody.client_secret !== client.clientSecret) {
    throw unauthorized('invalid_client', 'Client authentication failed');
  }

  const authorizationCode = await findAuthorizationCode(database, requestBody.code);
  if (!authorizationCode) {
    throw badRequest('invalid_grant', 'Authorization code is invalid');
  }

  validateAuthorizationCode(authorizationCode, requestBody);
  validatePkce(authorizationCode, requestBody.code_verifier);

  const user = await findUserById(database, authorizationCode.userId);
  if (!user) {
    throw badRequest('invalid_grant', 'Authorization code user is no longer available');
  }

  const signingKey = await getActivePrivateKey(database);
  if (!signingKey) {
    throw badRequest('server_error', 'No active signing key is available');
  }

  const tokenResponse = await issueTokens({
    user,
    client,
    authorizationCode,
    issuer: config.issuer,
    signingKey,
  });

  await withTransaction(database, async () => {
    await consumeAuthorizationCode(database, authorizationCode.code);
    await run(
      database,
      `
        INSERT INTO tokens (access_token, id_token, client_id, user_id, scope, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        tokenResponse.access_token,
        tokenResponse.id_token,
        client.clientId,
        user.id,
        authorizationCode.scope,
        isoDateAfterSeconds(ACCESS_TOKEN_LIFETIME_SECONDS),
      ],
    );
  });

  return tokenResponse;
}

export async function verifyAccessToken({ database, config, accessToken }) {
  const storedToken = await getStoredAccessToken(database, accessToken);
  if (!storedToken) {
    throw unauthorized('invalid_token', 'Access token is invalid');
  }

  if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
    throw unauthorized('invalid_token', 'Access token has expired');
  }

  const signingKey = await getPublicKeyForToken(database, accessToken);
  if (!signingKey) {
    throw unauthorized('invalid_token', 'No signing key is available for the access token');
  }

  const verification = await jwtVerify(accessToken, signingKey.publicKey, {
    issuer: config.issuer,
  });

  return {
    tokenId: storedToken.id,
    clientId: storedToken.clientId,
    subject: verification.payload.sub,
    email: verification.payload.email,
    name: verification.payload.name,
    scope: verification.payload.scope,
  };
}

function validateAuthorizationCode(authorizationCode, requestBody) {
  if (authorizationCode.consumedAt) {
    throw badRequest('invalid_grant', 'Authorization code has already been used');
  }

  if (new Date(authorizationCode.expiresAt).getTime() <= Date.now()) {
    throw badRequest('invalid_grant', 'Authorization code has expired');
  }

  if (authorizationCode.clientId !== requestBody.client_id) {
    throw badRequest('invalid_grant', 'Authorization code was not issued to this client');
  }

  if (authorizationCode.redirectUri !== requestBody.redirect_uri) {
    throw badRequest('invalid_grant', 'redirect_uri does not match the original authorization request');
  }
}

function validatePkce(authorizationCode, codeVerifier) {
  if (!authorizationCode.codeChallenge) {
    return;
  }

  if (!codeVerifier) {
    throw badRequest('invalid_grant', 'code_verifier is required for PKCE-protected authorization codes');
  }

  const challenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  if (challenge !== authorizationCode.codeChallenge) {
    throw badRequest('invalid_grant', 'code_verifier does not match the code_challenge');
  }
}

async function issueTokens({ user, client, authorizationCode, issuer, signingKey }) {
  const issuedAt = nowInSeconds();
  const accessTokenExpiration = issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS;
  const idTokenExpiration = issuedAt + ID_TOKEN_LIFETIME_SECONDS;
  const scope = authorizationCode.scope;

  const accessToken = await new SignJWT({
    scope,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'RS256', kid: signingKey.kid, typ: 'at+jwt' })
    .setIssuer(issuer)
    .setSubject(user.subject)
    .setAudience(client.clientId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(accessTokenExpiration)
    .sign(signingKey.privateKey);

  const idToken = await new SignJWT({
    email: user.email,
    email_verified: true,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'RS256', kid: signingKey.kid, typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject(user.subject)
    .setAudience(client.clientId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(idTokenExpiration)
    .sign(signingKey.privateKey);

  return {
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
    scope,
  };
}

async function getStoredAccessToken(database, accessToken) {
  const row = await get(
    database,
    'SELECT id, client_id, user_id, scope, expires_at FROM tokens WHERE access_token = ?',
    [accessToken],
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    scope: row.scope,
    expiresAt: row.expires_at,
  };
}
