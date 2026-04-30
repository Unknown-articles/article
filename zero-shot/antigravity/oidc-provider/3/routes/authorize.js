import express from 'express';
import { dbGet, dbRun } from '../db.js';
import crypto from 'crypto';

const router = express.Router();

const renderForm = (params, errorMsg = null) => {
  return \`
    <!DOCTYPE html>
    <html>
    <body>
      <h2>Login</h2>
      \${errorMsg ? \`<p style="color:red">\${errorMsg}</p>\` : ''}
      <form method="POST" action="/oauth2/authorize">
        <input type="hidden" name="client_id" value="\${params.client_id || ''}">
        <input type="hidden" name="redirect_uri" value="\${params.redirect_uri || ''}">
        <input type="hidden" name="response_type" value="\${params.response_type || ''}">
        <input type="hidden" name="scope" value="\${params.scope || ''}">
        <input type="hidden" name="state" value="\${params.state || ''}">
        <input type="hidden" name="code_challenge" value="\${params.code_challenge || ''}">
        <input type="hidden" name="code_challenge_method" value="\${params.code_challenge_method || ''}">
        
        <label>Username: <input type="text" name="username"></label><br/>
        <label>Password: <input type="password" name="password"></label><br/>
        <button type="submit">Login</button>
      </form>
    </body>
    </html>
  \`;
};

router.get('/', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id) return res.status(400).send('client_id missing');
  if (response_type !== 'code') return res.status(400).send('response_type missing or not "code"');
  if (!scope || !scope.split(' ').includes('openid')) return res.status(400).send('scope missing or does not include "openid"');

  const client = await dbGet('SELECT * FROM clients WHERE client_id = ?', [client_id]);
  if (!client) return res.status(400).send('client_id unknown');

  const registeredUris = JSON.parse(client.redirect_uris);
  if (!redirect_uri || !registeredUris.includes(redirect_uri)) {
    return res.status(400).send('redirect_uri missing or not registered');
  }

  res.send(renderForm({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method }));
});

router.post('/', async (req, res) => {
  const { 
    client_id, redirect_uri, response_type, scope, state, 
    code_challenge, code_challenge_method, username, password 
  } = req.body;

  // Verify client and redirect_uri again
  const client = await dbGet('SELECT * FROM clients WHERE client_id = ?', [client_id]);
  if (!client) return res.status(400).send('client_id unknown');
  const registeredUris = JSON.parse(client.redirect_uris);
  if (!redirect_uri || !registeredUris.includes(redirect_uri)) {
    return res.status(400).send('redirect_uri missing or not registered');
  }

  // Authenticate user
  const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (!user) {
    return res.status(401).send(renderForm({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method }, 'Invalid username or password'));
  }

  // Generate authorization code
  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  await dbRun(\`
    INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, used, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  \`, [code, client_id, user.id, redirect_uri, scope, code_challenge || null, code_challenge_method || null, expiresAt]);

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  res.redirect(302, redirectUrl.toString());
});

export default router;
