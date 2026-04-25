import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./oidc.db', (err) => {
  if (err) throw err;
});

export default db;

export function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getClientById(clientId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM clients WHERE client_id = ?', [clientId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function createAuthorizationCode(code, clientId, userId, redirectUri, scope, state, codeChallenge, codeChallengeMethod) {
  const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 min
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO authorization_codes (code, client_id, user_id, redirect_uri, scope, state, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code, clientId, userId, redirectUri, scope, state, codeChallenge, codeChallengeMethod, expiresAt], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

export function getAuthorizationCode(code) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM authorization_codes WHERE code = ? AND used = 0 AND expires_at > ?', [code, Math.floor(Date.now() / 1000)], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function markCodeUsed(code) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE authorization_codes SET used = 1 WHERE code = ?', [code], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function createToken(accessToken, idToken, clientId, userId, scope) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO tokens (access_token, id_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [accessToken, idToken, clientId, userId, scope, expiresAt], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

export function getToken(accessToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tokens WHERE access_token = ? AND expires_at > ?', [accessToken, Math.floor(Date.now() / 1000)], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}