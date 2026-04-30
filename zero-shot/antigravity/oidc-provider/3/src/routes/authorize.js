import express from 'express';
import crypto from 'crypto';
import { getClient, getUser, saveAuthCode } from '../db.js';

const router = express.Router();

router.get('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id) return res.status(400).send('client_id missing');
  if (response_type !== 'code') return res.status(400).send('response_type missing or not "code"');
  if (!scope || !scope.includes('openid')) return res.status(400).send('scope missing or does not include "openid"');
  if (!redirect_uri) return res.status(400).send('redirect_uri missing');

  const client = await getClient(client_id);
  if (!client) return res.status(400).send('unknown client_id');
  if (!client.redirect_uris.includes(redirect_uri)) return res.status(400).send('redirect_uri not registered for the client');

  // Render a simple HTML form
  res.send(`
    <html>
      <body>
        <h2>Login</h2>
        <form method="POST" action="/oauth2/authorize">
          <input type="hidden" name="client_id" value="${client_id}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="response_type" value="${response_type}" />
          <input type="hidden" name="scope" value="${scope}" />
          ${state ? `<input type="hidden" name="state" value="${state}" />` : ''}
          ${code_challenge ? `<input type="hidden" name="code_challenge" value="${code_challenge}" />` : ''}
          ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />` : ''}
          <div>
            <label>Username:</label>
            <input type="text" name="username" required />
          </div>
          <div>
            <label>Password:</label>
            <input type="password" name="password" required />
          </div>
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);
});

router.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, username, password } = req.body;

  const user = await getUser(username);

  // Re-render form with error if wrong credentials
  const renderError = (errorMsg) => {
    res.send(`
      <html>
        <body>
          <h2>Login</h2>
          <p style="color:red">${errorMsg}</p>
          <form method="POST" action="/oauth2/authorize">
            <input type="hidden" name="client_id" value="${client_id}" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <input type="hidden" name="response_type" value="${response_type}" />
            <input type="hidden" name="scope" value="${scope}" />
            ${state ? `<input type="hidden" name="state" value="${state}" />` : ''}
            ${code_challenge ? `<input type="hidden" name="code_challenge" value="${code_challenge}" />` : ''}
            ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />` : ''}
            <div>
              <label>Username:</label>
              <input type="text" name="username" required />
            </div>
            <div>
              <label>Password:</label>
              <input type="password" name="password" required />
            </div>
            <button type="submit">Login</button>
          </form>
        </body>
      </html>
    `);
  };

  if (!user || user.password !== password) {
    return renderError("Invalid credentials");
  }

  // Generate authorization code
  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  await saveAuthCode(code, client_id, redirect_uri, user.id, scope, code_challenge || null, code_challenge_method || null, expiresAt);

  // Redirect back
  let redirectUrl = `${redirect_uri}?code=${code}`;
  if (state) {
    redirectUrl += `&state=${state}`;
  }

  res.redirect(302, redirectUrl);
});

export default router;
