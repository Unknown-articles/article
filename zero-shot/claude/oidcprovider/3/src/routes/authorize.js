import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { getDb } from '../db/schema.js';

const router = Router();

function getClient(clientId) {
  return getDb().prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId);
}

function validateParams(query) {
  const { client_id, redirect_uri, response_type, scope } = query;
  if (!client_id) return 'client_id is required';

  const client = getClient(client_id);
  if (!client) return 'unknown client_id';

  if (!redirect_uri) return 'redirect_uri is required';
  const uris = JSON.parse(client.redirect_uris);
  if (!uris.includes(redirect_uri)) return 'redirect_uri not registered';

  if (response_type !== 'code') return 'response_type must be "code"';

  if (!scope || !scope.split(' ').includes('openid')) return 'scope must include "openid"';

  return null;
}

const LOGIN_FORM = (params, error = '') => `<!DOCTYPE html>
<html>
<head><title>Sign In</title></head>
<body>
  <h2>Sign In</h2>
  ${error ? `<p style="color:red">${error}</p>` : ''}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${params.client_id || ''}">
    <input type="hidden" name="redirect_uri" value="${params.redirect_uri || ''}">
    <input type="hidden" name="response_type" value="${params.response_type || ''}">
    <input type="hidden" name="scope" value="${params.scope || ''}">
    <input type="hidden" name="state" value="${params.state || ''}">
    <input type="hidden" name="code_challenge" value="${params.code_challenge || ''}">
    <input type="hidden" name="code_challenge_method" value="${params.code_challenge_method || ''}">
    <label>Username: <input type="text" name="username"></label><br>
    <label>Password: <input type="password" name="password"></label><br>
    <button type="submit">Sign In</button>
  </form>
</body>
</html>`;

router.get('/oauth2/authorize', (req, res) => {
  const err = validateParams(req.query);
  if (err) return res.status(400).json({ error: 'invalid_request', error_description: err });
  res.send(LOGIN_FORM(req.query));
});

router.post('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state,
          username, password, code_challenge, code_challenge_method } = req.body;

  const err = validateParams({ client_id, redirect_uri, response_type, scope });
  if (err) return res.status(400).json({ error: 'invalid_request', error_description: err });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const hash = createHash('sha256').update(password || '').digest('hex');

  if (!user || user.password_hash !== hash) {
    return res.status(401).send(LOGIN_FORM(
      { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method },
      'Invalid credentials — please try again.'
    ));
  }

  const code = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  db.prepare(`
    INSERT INTO authorization_codes
      (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code, client_id, user.id, redirect_uri, scope,
    code_challenge || null,
    code_challenge_method || null,
    expiresAt
  );

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  res.redirect(302, redirectUrl.toString());
});

export default router;
