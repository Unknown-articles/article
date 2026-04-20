import { generateKeyPairSync, createPublicKey, createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/sqlite.js';
import { ISSUER, ACCESS_TOKEN_TTL, AUTH_CODE_TTL, KEY_ID } from '../config.js';

// ─── RSA key pair (generated once at startup) ─────────────────────────────────

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const pubKeyObj = createPublicKey({ key: publicKey, format: 'pem' });
const jwk       = pubKeyObj.export({ format: 'jwk' });

// ─── Discovery + JWKS ─────────────────────────────────────────────────────────

export function getDiscovery() {
  return {
    issuer:                                ISSUER,
    authorization_endpoint:               `${ISSUER}/oauth2/authorize`,
    token_endpoint:                       `${ISSUER}/oauth2/token`,
    userinfo_endpoint:                    `${ISSUER}/userinfo`,
    jwks_uri:                             `${ISSUER}/.well-known/jwks.json`,
    response_types_supported:             ['code'],
    subject_types_supported:              ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported:                     ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['none'],
    claims_supported:                     ['sub', 'email', 'role']
  };
}

export function getJWKS() {
  return {
    keys: [{
      kty: jwk.kty,
      use: 'sig',
      kid: KEY_ID,
      alg: 'RS256',
      n:   jwk.n,
      e:   jwk.e
    }]
  };
}

// ─── Client / user lookup ─────────────────────────────────────────────────────

export function getClientById(clientId) {
  return db.prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

// ─── PKCE ─────────────────────────────────────────────────────────────────────

export function verifyPKCE(codeVerifier, codeChallenge) {
  const hash = createHash('sha256').update(codeVerifier).digest('base64url');
  return hash === codeChallenge;
}

// ─── Auth code ────────────────────────────────────────────────────────────────

export function createAuthCode(clientId, userId, codeChallenge, scope) {
  const code      = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL;
  db.prepare(`
    INSERT INTO auth_codes
      (code, client_id, user_id, code_challenge, code_challenge_method, scope, expires_at)
    VALUES (?, ?, ?, ?, 'S256', ?, ?)
  `).run(code, clientId, userId, codeChallenge || null, scope, expiresAt);
  return code;
}

export function consumeAuthCode(code) {
  const row = db.prepare('SELECT * FROM auth_codes WHERE code = ?').get(code);
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) return null;
  db.prepare('DELETE FROM auth_codes WHERE code = ?').run(code);
  return row;
}

// ─── Access tokens + ID token ─────────────────────────────────────────────────

export function createTokens(userId, clientId, scope) {
  const accessToken = randomBytes(32).toString('base64url');
  const expiresAt   = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL;

  db.prepare(`
    INSERT INTO tokens (access_token, user_id, client_id, scope, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(accessToken, userId, clientId, scope, expiresAt);

  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);

  const idToken = jwt.sign(
    {
      iss:   ISSUER,
      sub:   userId,
      aud:   clientId,
      email: user.email,
      role:  user.role,
      iat:   Math.floor(Date.now() / 1000),
      exp:   expiresAt
    },
    privateKey,
    { algorithm: 'RS256', keyid: KEY_ID }
  );

  return {
    access_token: accessToken,
    token_type:   'Bearer',
    expires_in:   ACCESS_TOKEN_TTL,
    id_token:     idToken,
    scope
  };
}

// ─── Token validation ─────────────────────────────────────────────────────────

export function validateAccessToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(token);
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) return null;
  return db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(row.user_id) || null;
}
