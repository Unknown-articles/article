import crypto from 'crypto';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { getActiveSigningKey } from '../crypto/keys.js';
import config from '../config/index.js';

export async function createTokens({ clientId, userId, scope, user }) {
  const signingKey = await getActiveSigningKey();

  const accessToken = crypto.randomBytes(32).toString('base64url');
  const now         = Math.floor(Date.now() / 1000);
  const expiresAt   = now + config.accessTokenExpiresIn;
  const tokenId     = uuidv4();

  const db = getDb();
  db.prepare(`
    INSERT INTO tokens (id, access_token, token_type, client_id, user_id, scope, expires_at)
    VALUES (?, ?, 'Bearer', ?, ?, ?, ?)
  `).run(tokenId, accessToken, clientId, userId, scope, expiresAt);

  const idToken = await new SignJWT({
    sub:                userId,
    aud:                clientId,
    email:              user.email,
    name:               user.name,
    preferred_username: user.username,
  })
    .setProtectedHeader({ alg: 'RS256', kid: signingKey.id })
    .setIssuer(config.issuer)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setJti(uuidv4())
    .sign(signingKey.privateKey);

  return {
    access_token: accessToken,
    id_token:     idToken,
    token_type:   'Bearer',
    expires_in:   config.accessTokenExpiresIn,
    scope,
  };
}

export function getTokenByAccessToken(accessToken) {
  const db = getDb();
  return (
    db.prepare('SELECT * FROM tokens WHERE access_token = ? AND revoked = 0').get(accessToken) || null
  );
}
