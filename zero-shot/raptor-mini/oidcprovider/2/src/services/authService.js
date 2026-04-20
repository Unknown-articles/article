import { getDb } from './db.js';
import { randomString, createCodeChallenge, verifyPassword } from '../utils.js';
import { TOKEN_EXPIRATION_SECONDS, AUTH_CODE_EXPIRATION_SECONDS, ISSUER_URL } from '../config.js';
import { signJwt } from './keys.js';

export async function findClient(clientId) {
  if (!clientId) {
    return null;
  }
  const db = getDb();
  return db.get('SELECT * FROM clients WHERE client_id = ?', clientId);
}

export function parseRedirectUris(client) {
  if (!client) return [];
  try {
    return JSON.parse(client.redirect_uris);
  } catch (error) {
    return [];
  }
}

export function validateRedirectUri(client, redirectUri) {
  return Boolean(client && redirectUri && parseRedirectUris(client).includes(redirectUri));
}

export async function authenticateUser(username, password) {
  const db = getDb();
  if (!username || !password) {
    return null;
  }
  const user = await db.get('SELECT * FROM users WHERE username = ?', username);
  if (!user) {
    return null;
  }
  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }
  return user;
}

export async function createAuthorizationCode({ client_id, redirect_uri, user_id, scope, code_challenge, code_challenge_method }) {
  const db = getDb();
  const code = randomString(32);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + AUTH_CODE_EXPIRATION_SECONDS;
  await db.run(
    'INSERT INTO authorization_codes (code, client_id, redirect_uri, user_id, scope, code_challenge, code_challenge_method, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    code,
    client_id,
    redirect_uri,
    user_id,
    scope,
    code_challenge || null,
    code_challenge_method || null,
    expiresAt,
    now
  );
  return code;
}

export async function consumeAuthorizationCode({ code, client_id, redirect_uri, code_verifier }) {
  const db = getDb();
  const record = await db.get('SELECT * FROM authorization_codes WHERE code = ?', code);
  if (!record || record.used) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (record.expires_at < now) {
    return null;
  }
  if (record.client_id !== client_id || record.redirect_uri !== redirect_uri) {
    return null;
  }
  if (record.code_challenge) {
    if (!code_verifier || record.code_challenge_method !== 'S256') {
      return null;
    }
    const expected = createCodeChallenge(code_verifier);
    if (expected !== record.code_challenge) {
      return null;
    }
  }
  await db.run('UPDATE authorization_codes SET used = 1 WHERE id = ?', record.id);
  return record;
}

export async function createAccessToken({ client_id, user_id, scope }) {
  const db = getDb();
  const accessToken = randomString(32);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_EXPIRATION_SECONDS;
  await db.run(
    'INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    accessToken,
    client_id,
    user_id,
    scope,
    expiresAt,
    now
  );
  return { accessToken, expiresAt };
}

export function createIdToken({ sub, client_id, email, name }) {
  const payload = { sub, email, name };
  return signJwt(payload, ISSUER_URL, client_id);
}

export async function getTokenByValue(accessToken) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const token = await db.get('SELECT * FROM tokens WHERE access_token = ?', accessToken);
  if (!token || token.expires_at < now) {
    return null;
  }
  return token;
}

export async function getUserById(userId) {
  const db = getDb();
  return db.get('SELECT * FROM users WHERE id = ?', userId);
}
