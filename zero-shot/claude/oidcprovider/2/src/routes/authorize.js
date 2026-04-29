import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db/index.js';
import { CODE_TTL } from '../config.js';

const router = Router();

function getClient(clientId) {
  return getDb().prepare('SELECT * FROM clients WHERE client_id=?').get(clientId);
}

function validateParams(query) {
  const { client_id, redirect_uri, response_type, scope } = query;
  if (!client_id) return 'client_id is required';
  const client = getClient(client_id);
  if (!client) return 'unknown client_id';
  const uris = JSON.parse(client.redirect_uris);
  if (!redirect_uri || !uris.includes(redirect_uri)) return 'redirect_uri invalid or not registered';
  if (response_type !== 'code') return 'response_type must be code';
  if (!scope || !scope.split(' ').includes('openid')) return 'scope must include openid';
  return null;
}

router.get('/oauth2/authorize', (req, res) => {
  const err = validateParams(req.query);
  if (err) return res.status(400).json({ error: 'invalid_request', error_description: err });

  const { client_id, redirect_uri, state, scope } = req.query;
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<h2>Sign In</h2>
<form method="POST" action="/oauth2/authorize">
  <input type="hidden" name="client_id" value="${escHtml(client_id)}">
  <input type="hidden" name="redirect_uri" value="${escHtml(redirect_uri)}">
  <input type="hidden" name="response_type" value="code">
  <input type="hidden" name="scope" value="${escHtml(scope || 'openid')}">
  <input type="hidden" name="state" value="${escHtml(state || '')}">
  <label>Username: <input type="text" name="username"></label><br>
  <label>Password: <input type="password" name="password"></label><br>
  <button type="submit">Sign In</button>
</form>
</body></html>`);
});

router.post('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state,
          username, password, code_challenge, code_challenge_method } = req.body;

  const err = validateParams({ client_id, redirect_uri, response_type, scope });
  if (err) return res.status(400).json({ error: 'invalid_request', error_description: err });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  const hashed = createHash('sha256').update(password || '').digest('hex');

  if (!user || user.password !== hashed) {
    const { client_id: cid, redirect_uri: ruri, state: st, scope: sc } = req.body;
    return res.status(401).type('html').send(`<!DOCTYPE html>
<html><body>
<p style="color:red">Invalid credentials — please try again.</p>
<h2>Sign In</h2>
<form method="POST" action="/oauth2/authorize">
  <input type="hidden" name="client_id" value="${escHtml(cid)}">
  <input type="hidden" name="redirect_uri" value="${escHtml(ruri)}">
  <input type="hidden" name="response_type" value="code">
  <input type="hidden" name="scope" value="${escHtml(sc || 'openid')}">
  <input type="hidden" name="state" value="${escHtml(st || '')}">
  <label>Username: <input type="text" name="username"></label><br>
  <label>Password: <input type="password" name="password"></label><br>
  <button type="submit">Sign In</button>
</form>
</body></html>`);
  }

  const code = randomBytes(32).toString('base64url');
  const expires_at = Math.floor(Date.now() / 1000) + CODE_TTL;

  db.prepare(`INSERT INTO auth_codes
    (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(code, client_id, user.id, redirect_uri, scope,
      code_challenge || null, code_challenge_method || null, expires_at);

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  return res.redirect(302, url.toString());
});

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default router;
