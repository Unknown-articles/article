import { randomBytes } from 'crypto';
import { Router } from 'express';
import db from '../db.js';

const router = Router();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getClient(clientId) {
  return dbGet('SELECT * FROM clients WHERE client_id = ?', [clientId]);
}

function loginForm({ client_id, redirect_uri, response_type, scope, state,
                     code_challenge, code_challenge_method, error = '' }) {
  const esc = (v = '') => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Sign in</title></head>
<body>
  <h2>Sign in</h2>
  ${error ? `<p style="color:red">${esc(error)}</p>` : ''}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id"             value="${esc(client_id)}">
    <input type="hidden" name="redirect_uri"          value="${esc(redirect_uri)}">
    <input type="hidden" name="response_type"         value="${esc(response_type)}">
    <input type="hidden" name="scope"                 value="${esc(scope)}">
    <input type="hidden" name="state"                 value="${esc(state)}">
    <input type="hidden" name="code_challenge"        value="${esc(code_challenge)}">
    <input type="hidden" name="code_challenge_method" value="${esc(code_challenge_method)}">
    <div>
      <label>Username<br><input type="text"     name="username" required></label>
    </div>
    <div>
      <label>Password<br><input type="password" name="password" required></label>
    </div>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

async function validateOAuthParams({ client_id, redirect_uri, response_type, scope }) {
  if (!client_id) return { error: 'missing client_id' };

  const client = await getClient(client_id);
  if (!client) return { error: 'unknown client_id' };

  if (!redirect_uri) return { error: 'missing redirect_uri' };

  const allowedUris = JSON.parse(client.redirect_uris);
  if (!allowedUris.includes(redirect_uri)) return { error: 'redirect_uri not registered' };

  if (response_type !== 'code') return { error: 'response_type must be "code"' };

  if (!scope || !scope.split(' ').includes('openid')) {
    return { error: 'scope must include "openid"' };
  }

  return { client };
}

router.get('/oauth2/authorize', async (req, res) => {
  const params = req.query;
  const { error, client } = await validateOAuthParams(params);
  if (error) return res.status(400).json({ error });
  void client;
  res.status(200).send(loginForm(params));
});

router.post('/oauth2/authorize', async (req, res) => {
  const {
    client_id, redirect_uri, response_type, scope, state,
    username, password,
    code_challenge, code_challenge_method,
  } = req.body;

  const { error } = await validateOAuthParams({ client_id, redirect_uri, response_type, scope });
  if (error) return res.status(400).json({ error });

  const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || user.password !== password) {
    return res.status(401).send(loginForm({
      client_id, redirect_uri, response_type, scope, state,
      code_challenge, code_challenge_method,
      error: 'Invalid username or password.',
    }));
  }

  const code = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  await dbRun(
    `INSERT INTO auth_codes
       (code, client_id, user_id, redirect_uri, scope,
        code_challenge, code_challenge_method, expires_at, used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      code,
      client_id,
      user.id,
      redirect_uri,
      scope,
      code_challenge || null,
      code_challenge_method || null,
      expiresAt,
    ]
  );

  const location = new URL(redirect_uri);
  location.searchParams.set('code', code);
  if (state) location.searchParams.set('state', state);

  res.redirect(302, location.toString());
});

export default router;
