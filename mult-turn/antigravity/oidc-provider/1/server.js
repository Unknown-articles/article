import express from 'express';
import crypto from 'crypto';
import db, { initDb } from './db.js';
import { initKeys, getJwks, getKid, getPrivateKey } from './keys.js';

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const getClient = (client_id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM clients WHERE client_id = ?`, [client_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUser = (username) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const createAuthCode = (code, client_id, user_id, redirect_uri, scope, challenge, challenge_method, expires_at) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, client_id, user_id, redirect_uri, scope, challenge, challenge_method, expires_at],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

const getAuthCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM auth_codes WHERE code = ?`, [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const markCodeUsed = (id) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE auth_codes SET used = 1 WHERE id = ?`, [id], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

const storeToken = (access_token, client_id, user_id, scope, expires_at) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [access_token, client_id, user_id, scope, expires_at],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure all responses set Content-Type: application/json
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJwks());
});

app.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth2/authorize`,
    token_endpoint: `${baseUrl}/oauth2/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"]
  });
});

app.get('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state } = req.query;

  if (!client_id) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
  }

  let client;
  try {
    client = await getClient(client_id);
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  if (!client) {
    return res.status(400).json({ error: 'invalid_client', error_description: 'client not found' });
  }

  if (!redirect_uri) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
  }

  let validRedirectUris = [];
  try {
    validRedirectUris = JSON.parse(client.redirect_uris);
  } catch (e) {
    validRedirectUris = [];
  }

  if (!validRedirectUris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'invalid redirect_uri' });
  }

  if (!response_type || response_type !== 'code') {
    return res.status(400).json({ error: 'invalid_request', error_description: 'response_type must be code' });
  }

  if (!scope || !scope.split(' ').includes('openid')) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'scope must include openid' });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>Authorize</title></head>
      <body>
        <h2>Login to Authorize</h2>
        <form method="POST" action="/oauth2/authorize">
          <input type="hidden" name="client_id" value="${escapeHTML(client_id)}" />
          <input type="hidden" name="redirect_uri" value="${escapeHTML(redirect_uri)}" />
          <input type="hidden" name="state" value="${escapeHTML(state)}" />
          <input type="hidden" name="response_type" value="${escapeHTML(response_type)}" />
          <input type="hidden" name="scope" value="${escapeHTML(scope)}" />
          
          <div>
            <label>Username:</label>
            <input type="text" name="username" required />
          </div>
          <div>
            <label>Password:</label>
            <input type="password" name="password" required />
          </div>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

app.post('/oauth2/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;

  let user;
  try {
    user = await getUser(username);
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  const renderErrorForm = (errorMsg) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authorize</title></head>
        <body>
          <h2>Login to Authorize</h2>
          <p style="color:red;">${escapeHTML(errorMsg)}</p>
          <form method="POST" action="/oauth2/authorize">
            <input type="hidden" name="client_id" value="${escapeHTML(client_id)}" />
            <input type="hidden" name="redirect_uri" value="${escapeHTML(redirect_uri)}" />
            <input type="hidden" name="state" value="${escapeHTML(state)}" />
            <input type="hidden" name="response_type" value="${escapeHTML(response_type)}" />
            <input type="hidden" name="scope" value="${escapeHTML(scope)}" />
            
            <div>
              <label>Username:</label>
              <input type="text" name="username" required />
            </div>
            <div>
              <label>Password:</label>
              <input type="password" name="password" required />
            </div>
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `);
  };

  if (!user || user.password !== password) {
    return renderErrorForm("Invalid username or password");
  }

  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + (10 * 60);

  try {
    await createAuthCode(
      code,
      client_id,
      user.id,
      redirect_uri,
      scope,
      code_challenge || null,
      code_challenge_method || null,
      expiresAt
    );
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  let finalUri = `${redirect_uri}?code=${encodeURIComponent(code)}`;
  if (state) {
    finalUri += `&state=${encodeURIComponent(state)}`;
  }
  
  res.redirect(302, finalUri);
});

app.post('/oauth2/token', async (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  let client_id = req.body.client_id;
  let client_secret = req.body.client_secret;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const b64Value = authHeader.substring(6);
      const decoded = Buffer.from(b64Value, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        client_id = decoded.substring(0, colonIdx);
        client_secret = decoded.substring(colonIdx + 1);
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!client_id) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  let client;
  try {
    client = await getClient(client_id);
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  if (!client || client.client_secret !== client_secret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  let authCodeRecord;
  try {
    authCodeRecord = await getAuthCode(code);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }

  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);

  if (!authCodeRecord) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCodeRecord.used === 1) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCodeRecord.expires_at < now) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCodeRecord.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (authCodeRecord.client_id !== client_id) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCodeRecord.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (hash !== authCodeRecord.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
  }

  try {
    await markCodeUsed(authCodeRecord.id);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }

  const accessToken = crypto.randomBytes(32).toString('hex');

  try {
    await storeToken(accessToken, client_id, authCodeRecord.user_id, authCodeRecord.scope, now + 3600);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }

  const header = { alg: 'RS256', kid: getKid() };
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const payload = {
    sub: String(authCodeRecord.user_id),
    iss: baseUrl,
    aud: client_id,
    exp: now + 3600,
    iat: now
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signInput = headerB64 + '.' + payloadB64;
  
  const signature = crypto.sign('sha256', Buffer.from(signInput), getPrivateKey()).toString('base64url');
  const idToken = signInput + '.' + signature;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    access_token: accessToken,
    id_token: idToken,
    token_type: "Bearer",
    expires_in: 3600
  });
});

const getToken = (access_token) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM tokens WHERE access_token = ?`, [access_token], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const handleUserInfo = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const accessToken = authHeader.substring(7).trim();
  let tokenRecord;
  try {
    tokenRecord = await getToken(accessToken);
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  const now = Math.floor(Date.now() / 1000);

  if (!tokenRecord || tokenRecord.expires_at < now) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  let user;
  try {
    user = await getUserById(tokenRecord.user_id);
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }

  if (!user) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const response = {
    sub: String(user.id)
  };

  if (tokenRecord.scope && tokenRecord.scope.split(' ').includes('email')) {
    response.email = user.email;
  }

  res.status(200).json(response);
};

app.get('/userinfo', handleUserInfo);
app.post('/userinfo', handleUserInfo);

async function start() {
  await initDb();
  await initKeys();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
