import { db } from '../services/db.js';

export async function getUserById(id) {
  return await db.get('SELECT * FROM users WHERE id = ?', [id]);
}

export async function getClientById(clientId) {
  const client = await db.get('SELECT * FROM clients WHERE client_id = ?', [clientId]);
  if (client) {
    client.redirect_uris = JSON.parse(client.redirect_uris);
  }
  return client;
}

export async function saveAuthCode(code, clientId, userId, redirectUri, scope, codeChallenge, method) {
  const expiresAt = Date.now() + 600000; // 10 minutes
  await db.run('INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, scope, expires_at, code_challenge, code_challenge_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [code, clientId, userId, redirectUri, scope, expiresAt, codeChallenge, method]);
}

export async function getAuthCode(code) {
  return await db.get('SELECT * FROM auth_codes WHERE code = ?', [code]);
}

export async function deleteAuthCode(code) {
  await db.run('DELETE FROM auth_codes WHERE code = ?', [code]);
}

export async function saveTokens(accessToken, idToken, refreshToken, clientId, userId) {
  const expiresAt = Date.now() + 3600000; // 1 hour
  await db.run('INSERT INTO tokens (access_token, id_token, refresh_token, client_id, user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [accessToken, idToken, refreshToken, clientId, userId, expiresAt]);
}

export async function getToken(accessToken) {
  return await db.get('SELECT * FROM tokens WHERE access_token = ?', [accessToken]);
}