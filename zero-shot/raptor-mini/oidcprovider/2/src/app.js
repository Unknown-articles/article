import express from 'express';
import bodyParser from 'body-parser';
import { URLSearchParams } from 'node:url';
import { initDb, get, run } from './db.js';
import { initKeys, getJwks, createIdToken } from './keys.js';
import { randomString, sha256, base64UrlEncode, nowSeconds } from './utils.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const jsonResponse = (res, status, payload) => {
  res.status(status).json(payload);
};

const buildBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const parseAuthorizationHeader = (header) => {
  if (!header || !header.startsWith('Basic ')) return null;
  const payload = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const [client_id, client_secret] = payload.split(':');
  if (!client_id || !client_secret) return null;
  return { client_id, client_secret };
};

const loadClient = async (clientId) => {
  if (!clientId) return null;
  const client = await get('SELECT * FROM clients WHERE client_id = ?', [clientId]);
  if (!client) return null;
  return {
    ...client,
    redirectUris: JSON.parse(client.redirect_uris)
  };
};

const loadUser = async (username, password) => {
  if (!username || !password) return null;
  return await get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
};

const validateAuthorizeParams = (params, client) => {
  if (!params.client_id || !client) {
    return { error: 'invalid_request', message: 'Unknown or missing client_id' };
  }
  if (!params.redirect_uri) {
    return { error: 'invalid_request', message: 'Missing redirect_uri' };
  }
  if (!client.redirectUris.includes(params.redirect_uri)) {
    return { error: 'invalid_request', message: 'redirect_uri is not registered' };
  }
  if (params.response_type !== 'code') {
    return { error: 'invalid_request', message: 'Unsupported response_type' };
  }
  if (!params.scope || !params.scope.split(' ').includes('openid')) {
    return { error: 'invalid_request', message: 'openid scope is required' };
  }
  return null;
};

const renderAuthorizeForm = ({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, error = '' }) => {
  const fields = [
    { name: 'client_id', value: client_id },
    { name: 'redirect_uri', value: redirect_uri },
    { name: 'response_type', value: response_type },
    { name: 'scope', value: scope },
    { name: 'state', value: state || '' }
  ];
  if (code_challenge) fields.push({ name: 'code_challenge', value: code_challenge });
  if (code_challenge_method) fields.push({ name: 'code_challenge_method', value: code_challenge_method });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Login</title>
</head>
<body>
  <h1>Authorize application</h1>
  ${error ? `<p style="color:red">${error}</p>` : ''}
  <form method="post" action="/oauth2/authorize">
    ${fields.map(({ name, value }) => `<input type="hidden" name="${name}" value="${value ?? ''}" />`).join('\n')}
    <div>
      <label>Username<br /><input type="text" name="username" /></label>
    </div>
    <div>
      <label>Password<br /><input type="password" name="password" /></label>
    </div>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
};

const authenticateClient = async (req) => {
  const authHeader = req.header('authorization');
  let client_id;
  let client_secret;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credential = parseAuthorizationHeader(authHeader);
    if (credential) {
      client_id = credential.client_id;
      client_secret = credential.client_secret;
    }
  }
  if (!client_id) {
    client_id = req.body.client_id;
    client_secret = req.body.client_secret;
  }
  if (!client_id || !client_secret) return null;
  const client = await loadClient(client_id);
  if (!client || client.client_secret !== client_secret) return null;
  return client;
};

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/.well-known/openid-configuration', (req, res) => {
  const issuer = buildBaseUrl(req);
  jsonResponse(res, 200, {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256']
  });
});

app.get('/.well-known/jwks.json', async (req, res, next) => {
  try {
    const keys = await getJwks();
    jsonResponse(res, 200, { keys });
  } catch (err) {
    next(err);
  }
});

app.get('/oauth2/authorize', async (req, res, next) => {
  try {
    const params = {
      client_id: req.query.client_id,
      redirect_uri: req.query.redirect_uri,
      response_type: req.query.response_type,
      scope: req.query.scope,
      state: req.query.state,
      code_challenge: req.query.code_challenge,
      code_challenge_method: req.query.code_challenge_method
    };
    const client = await loadClient(params.client_id);
    const invalid = validateAuthorizeParams(params, client);
    if (invalid) {
      return jsonResponse(res, 400, { error: invalid.error, error_description: invalid.message });
    }
    if (params.code_challenge_method && params.code_challenge_method !== 'S256') {
      return jsonResponse(res, 400, { error: 'invalid_request', error_description: 'Unsupported code_challenge_method' });
    }
    res.type('html').send(renderAuthorizeForm(params));
  } catch (err) {
    next(err);
  }
});

app.post('/oauth2/authorize', async (req, res, next) => {
  try {
    const params = {
      client_id: req.body.client_id,
      redirect_uri: req.body.redirect_uri,
      response_type: req.body.response_type,
      scope: req.body.scope,
      state: req.body.state,
      code_challenge: req.body.code_challenge,
      code_challenge_method: req.body.code_challenge_method
    };
    const client = await loadClient(params.client_id);
    const invalid = validateAuthorizeParams(params, client);
    if (invalid) {
      return jsonResponse(res, 400, { error: invalid.error, error_description: invalid.message });
    }
    if (params.code_challenge_method && params.code_challenge_method !== 'S256') {
      return jsonResponse(res, 400, { error: 'invalid_request', error_description: 'Unsupported code_challenge_method' });
    }
    const user = await loadUser(req.body.username, req.body.password);
    if (!user) {
      res.type('html').send(renderAuthorizeForm({ ...params, error: 'Invalid username or password' }));
      return;
    }
    const authCode = randomString(32);
    const expiresAt = nowSeconds() + 600;
    await run(
      'INSERT INTO authorization_codes (code, client_id, redirect_uri, scope, user_id, code_challenge, code_challenge_method, expires_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [authCode, params.client_id, params.redirect_uri, params.scope, user.id, params.code_challenge || null, params.code_challenge_method || null, expiresAt, params.state || null]
    );
    const redirectParams = new URLSearchParams({ code: authCode });
    if (params.state) {
      redirectParams.set('state', params.state);
    }
    res.redirect(302, `${params.redirect_uri}?${redirectParams.toString()}`);
  } catch (err) {
    next(err);
  }
});

app.post('/oauth2/token', async (req, res, next) => {
  try {
    const grant_type = req.body.grant_type;
    const code = req.body.code;
    const redirect_uri = req.body.redirect_uri;
    if (!grant_type || !code || !redirect_uri) {
      return jsonResponse(res, 400, { error: 'invalid_request' });
    }
    if (grant_type !== 'authorization_code') {
      return jsonResponse(res, 400, { error: 'unsupported_grant_type' });
    }
    const client = await authenticateClient(req);
    if (!client) {
      return res.status(401).json({ error: 'invalid_client' });
    }
    const codeRow = await get('SELECT * FROM authorization_codes WHERE code = ?', [code]);
    if (!codeRow || codeRow.used || codeRow.expires_at < nowSeconds()) {
      return jsonResponse(res, 400, { error: 'invalid_grant' });
    }
    if (codeRow.client_id !== client.client_id || codeRow.redirect_uri !== redirect_uri) {
      return jsonResponse(res, 400, { error: 'invalid_grant' });
    }
    if (codeRow.code_challenge) {
      const verifier = req.body.code_verifier;
      if (!verifier) {
        return jsonResponse(res, 400, { error: 'invalid_grant' });
      }
      const verifierHash = base64UrlEncode(sha256(verifier));
      if (verifierHash !== codeRow.code_challenge) {
        return jsonResponse(res, 400, { error: 'invalid_grant' });
      }
    }
    const user = await get('SELECT * FROM users WHERE id = ?', [codeRow.user_id]);
    if (!user) {
      return jsonResponse(res, 400, { error: 'invalid_grant' });
    }
    const accessToken = randomString(32);
    const expiresIn = 3600;
    const now = nowSeconds();
    await run(
      'INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [accessToken, client.client_id, user.id, codeRow.scope, now + expiresIn, now]
    );
    await run('UPDATE authorization_codes SET used = 1 WHERE id = ?', [codeRow.id]);
    const idToken = await createIdToken({
      sub: user.sub,
      aud: client.client_id,
      iss: `${req.protocol}://${req.get('host')}`,
      email: user.email,
      scope: codeRow.scope
    });
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    jsonResponse(res, 200, {
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: expiresIn
    });
  } catch (err) {
    next(err);
  }
});

app.get('/userinfo', async (req, res, next) => {
  try {
    const authHeader = req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    const accessToken = authHeader.slice('Bearer '.length).trim();
    if (!accessToken) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    const tokenRow = await get('SELECT * FROM tokens WHERE access_token = ?', [accessToken]);
    if (!tokenRow || tokenRow.expires_at < nowSeconds()) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    const user = await get('SELECT * FROM users WHERE id = ?', [tokenRow.user_id]);
    if (!user) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    const claims = { sub: user.sub };
    if (tokenRow.scope.split(' ').includes('email')) {
      claims.email = user.email;
    }
    jsonResponse(res, 200, claims);
  } catch (err) {
    next(err);
  }
});

app.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'server_error', error_description: err.message });
});

const start = async () => {
  await initDb();
  await initKeys();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => {
    console.log(`OIDC provider listening on http://localhost:${port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
