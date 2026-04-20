import { Router } from 'express';
import { get, run } from '../db/index.js';
import crypto from 'crypto';
import { signJwt } from '../utils/jwt.js';

const router = Router();

router.get('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id) return res.status(400).send('client_id missing');
  const client = await get('SELECT * FROM clients WHERE client_id = ?', [client_id]);
  if (!client) return res.status(400).send('client_id unknown');

  if (!redirect_uri) return res.status(400).send('redirect_uri missing');
  const registeredUris = JSON.parse(client.redirect_uris || '[]');
  if (!registeredUris.includes(redirect_uri)) return res.status(400).send('redirect_uri not registered');

  if (!response_type || response_type !== 'code') return res.status(400).send('response_type missing or invalid (must be code)');
  
  if (!scope || !scope.split(' ').includes('openid')) return res.status(400).send('scope missing or does not include openid');

  res.send(`
    <html>
      <body>
        <h2>Login</h2>
        <form method="POST" action="/oauth2/authorize">
          <input type="hidden" name="client_id" value="${client_id}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="response_type" value="${response_type}" />
          <input type="hidden" name="scope" value="${scope}" />
          ${state ? '<input type="hidden" name="state" value="' + state + '" />' : ''}
          ${code_challenge ? '<input type="hidden" name="code_challenge" value="' + code_challenge + '" />' : ''}
          ${code_challenge_method ? '<input type="hidden" name="code_challenge_method" value="' + code_challenge_method + '" />' : ''}
          
          <label>Username: <input type="text" name="username" required /></label><br/>
          <label>Password: <input type="password" name="password" required /></label><br/>
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);
});

router.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, username, password } = req.body;

  const user = await get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

  if (!user) {
    return res.status(401).send(`
      <html>
        <body>
          <h2>Login</h2>
          <p style="color:red;">Invalid credentials.</p>
          <form method="POST" action="/oauth2/authorize">
            <input type="hidden" name="client_id" value="${client_id}" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <input type="hidden" name="response_type" value="${response_type}" />
            <input type="hidden" name="scope" value="${scope}" />
            ${state ? '<input type="hidden" name="state" value="' + state + '" />' : ''}
            ${code_challenge ? '<input type="hidden" name="code_challenge" value="' + code_challenge + '" />' : ''}
            ${code_challenge_method ? '<input type="hidden" name="code_challenge_method" value="' + code_challenge_method + '" />' : ''}
            
            <label>Username: <input type="text" name="username" required /></label><br/>
            <label>Password: <input type="password" name="password" required /></label><br/>
            <button type="submit">Login</button>
          </form>
        </body>
      </html>
    `);
  }

  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await run(
    'INSERT INTO auth_codes (code, client_id, redirect_uri, sub, scope, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [code, client_id, redirect_uri, user.id.toString(), scope, code_challenge || null, code_challenge_method || null, expiresAt]
  );

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.append('code', code);
  if (state) redirectUrl.searchParams.append('state', state);

  res.redirect(302, redirectUrl.toString());
});

router.post('/oauth2/token', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const b64auth = authHeader.split(' ')[1];
    const [id, secret] = Buffer.from(b64auth, 'base64').toString('utf8').split(':');
    clientId = id;
    clientSecret = secret;
  }

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const client = await get('SELECT * FROM clients WHERE client_id = ?', [clientId]);
  if (!client || client.client_secret !== clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  if (!grant_type || !code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const authCode = await get('SELECT * FROM auth_codes WHERE code = ?', [code]);
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.used || Date.now() > authCode.expires_at) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.redirect_uri !== redirect_uri || authCode.client_id !== clientId) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // PKCE verification
  if (authCode.code_challenge) {
    if (!code_verifier) return res.status(400).json({ error: 'invalid_grant' });
    
    if (authCode.code_challenge_method === 'S256') {
      const hash = crypto.createHash('sha256').update(code_verifier).digest();
      const derivedChallenge = hash.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      if (derivedChallenge !== authCode.code_challenge) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
    }
  }

  // Mark code as used
  await run('UPDATE auth_codes SET used = 1 WHERE code = ?', [code]);

  // Generate tokens
  const accessToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = 3600;

  // Save access token
  await run('INSERT INTO tokens (access_token, client_id, sub, scope, expires_at) VALUES (?, ?, ?, ?, ?)',
    [accessToken, clientId, authCode.sub, authCode.scope, Date.now() + expiresIn * 1000]
  );

  const idTokenPayload = {
    sub: authCode.sub,
    iss: `${req.protocol}://${req.get('host')}`,
    aud: clientId,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000)
  };

  const idToken = signJwt(idTokenPayload);

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: expiresIn
  });
});

export default router;
