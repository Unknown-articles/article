import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import crypto from 'crypto';

const serverPort = process.env.PORT || 3000;
const database = new sqlite3.Database('./database.sqlite');

database.serialize(() => {
  database.run(`CREATE TABLE IF NOT EXISTS user_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL
  )`);

  database.run(`CREATE TABLE IF NOT EXISTS client_apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT NOT NULL
  )`);

  database.run(`CREATE TABLE IF NOT EXISTS auth_codes_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
  )`);

  database.run(`CREATE TABLE IF NOT EXISTS access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);

  // Seed client
  database.get(`SELECT COUNT(*) as count FROM client_apps WHERE client_id = ?`, ['test-client'], (err, row) => {
    if (err) {
      console.error('Error checking client:', err);
    } else if (row.count === 0) {
      database.run(`INSERT INTO client_apps (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`,
        ['test-client', 'test-secret', JSON.stringify(["http://localhost:8080/callback", "http://localhost:3001/callback"])],
        (err) => {
          if (err) console.error('Error seeding client:', err);
        });
    }
  });

  // Seed user
  database.get(`SELECT COUNT(*) as count FROM user_accounts WHERE username = ?`, ['testuser'], (err, row) => {
    if (err) {
      console.error('Error checking user:', err);
    } else if (row.count === 0) {
      database.run(`INSERT INTO user_accounts (username, password, email) VALUES (?, ?, ?)`,
        ['testuser', 'password123', 'testuser@example.com'],
        (err) => {
          if (err) console.error('Error seeding user:', err);
        });
    }
  });
});

const keysDir = './keys';
if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir);

const privatePath = './keys/private.pem';
const publicPath = './keys/public.pem';
const kidPath = './keys/kid.txt';

let publicKey, privateKey, kid;

if (fs.existsSync(privatePath) && fs.existsSync(publicPath) && fs.existsSync(kidPath)) {
  const privatePem = fs.readFileSync(privatePath, 'utf8');
  const publicPem = fs.readFileSync(publicPath, 'utf8');
  privateKey = crypto.createPrivateKey(privatePem);
  publicKey = crypto.createPublicKey(publicPem);
  kid = fs.readFileSync(kidPath, 'utf8').trim();
} else {
  const { privateKey: privKey, publicKey: pubKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  privateKey = crypto.createPrivateKey(privKey);
  fs.writeFileSync(privatePath, privKey);
  fs.writeFileSync(publicPath, pubKey);
  publicKey = crypto.createPublicKey(pubKey);
  const jwkTemp = publicKey.export({ format: 'jwk' });
  kid = crypto.createHash('sha256').update(JSON.stringify(jwkTemp)).digest('base64url').slice(0, 10);
  fs.writeFileSync(kidPath, kid);
}

const jwk = publicKey.export({ format: 'jwk' });
jwk.kty = 'RSA';
jwk.use = 'sig';
jwk.alg = 'RS256';
jwk.kid = kid;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json({ keys: [jwk] });
});

app.get('/.well-known/openid-configuration', (req, res) => {
  const base_url = req.protocol + '://' + req.get('host');
  res.json({
    issuer: base_url,
    authorization_endpoint: base_url + "/oauth2/authorize",
    token_endpoint: base_url + "/oauth2/token",
    userinfo_endpoint: base_url + "/userinfo",
    jwks_uri: base_url + "/.well-known/jwks.json",
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"]
  });
});

app.get('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
  }

  database.get(`SELECT * FROM client_apps WHERE client_id = ?`, [client_id], (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    const uris = JSON.parse(row.redirect_uris);
    if (!redirect_uri || !uris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    if (response_type !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type' });
    }

    if (!scope || !scope.split(' ').includes('openid')) {
      return res.status(400).json({ error: 'invalid_scope' });
    }

    const html = `
<!DOCTYPE html>
<html>
<body>
  <h1>Sign In</h1>
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${client_id}">
    <input type="hidden" name="redirect_uri" value="${redirect_uri}">
    <input type="hidden" name="state" value="${state || ''}">
    <input type="hidden" name="response_type" value="${response_type}">
    <input type="hidden" name="scope" value="${scope}">
    <label>User ID: <input type="text" name="username" required></label><br>
    <label>Passcode: <input type="password" name="password" required></label><br>
    <button type="submit">Authenticate</button>
  </form>
</body>
</html>
    `;
    res.send(html);
  });
});

app.post('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;

  database.get(`SELECT * FROM user_accounts WHERE username = ?`, [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal server error');
    }

    if (!user || user.password !== password) {
      const html = `
<!DOCTYPE html>
<html>
<body>
  <h1>Sign In</h1>
  <p style="color:red">Invalid user ID or passcode</p>
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${client_id}">
    <input type="hidden" name="redirect_uri" value="${redirect_uri}">
    <input type="hidden" name="state" value="${state || ''}">
    <input type="hidden" name="response_type" value="${response_type}">
    <input type="hidden" name="scope" value="${scope}">
    <label>User ID: <input type="text" name="username" required></label><br>
    <label>Passcode: <input type="password" name="password" required></label><br>
    <button type="submit">Authenticate</button>
  </form>
</body>
</html>
      `;
      return res.send(html);
    }

    // Valid credentials
    const code = crypto.randomBytes(32).toString('base64url');
    const expires_at = Math.floor(Date.now() / 1000) + 600; // 10 minutes

    database.run(`INSERT INTO auth_codes_table (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [code, client_id, user.id, redirect_uri, scope, code_challenge || null, code_challenge_method || null, expires_at],
      (err) => {
        if (err) {
          console.error('Error inserting auth code:', err);
          return res.status(500).send('Internal server error');
        }

        let redirectUrl = `${redirect_uri}?code=${code}`;
        if (state) {
          redirectUrl += `&state=${encodeURIComponent(state)}`;
        }
        res.redirect(302, redirectUrl);
      });
  });
});

app.post('/oauth2/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id: bodyClientId, client_secret: bodyClientSecret } = req.body;

  // Check required params
  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!code) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  // Determine client credentials
  let clientId = bodyClientId;
  let clientSecret = bodyClientSecret;

  if (!clientId || !clientSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const base64 = authHeader.split(' ')[1];
        const decoded = Buffer.from(base64, 'base64').toString();
        const [cid, csec] = decoded.split(':');
        clientId = cid;
        clientSecret = csec;
      } catch (err) {
        return res.status(401).json({ error: 'invalid_client' });
      }
    }
  }

  if (!clientId) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // Validate client
  database.get(`SELECT * FROM client_apps WHERE client_id = ?`, [clientId], (err, client) => {
    if (err || !client || client.client_secret !== clientSecret) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    // Validate authorization code
    database.get(`SELECT * FROM auth_codes_table WHERE code = ?`, [code], (err, authCode) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal server error');
      }

      if (!authCode || authCode.used === 1 || authCode.expires_at < Math.floor(Date.now() / 1000) || authCode.redirect_uri !== redirect_uri || authCode.client_id !== clientId) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // PKCE verification
      if (authCode.code_challenge) {
        const { code_verifier } = req.body;
        if (!code_verifier) {
          return res.status(400).json({ error: 'invalid_grant' });
        }
        const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
        if (hash !== authCode.code_challenge) {
          return res.status(400).json({ error: 'invalid_grant' });
        }
      }

      // Mark code as used
      database.run(`UPDATE auth_codes_table SET used = 1 WHERE id = ?`, [authCode.id], (err) => {
        if (err) {
          console.error('Error updating auth code:', err);
          return res.status(500).send('Internal server error');
        }

        // Generate access token
        const access_token = crypto.randomBytes(32).toString('base64url');
        const tokenExpiresAt = Math.floor(Date.now() / 1000) + 3600;

        // Store access token
        database.run(`INSERT INTO access_tokens (access_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)`,
          [access_token, clientId, authCode.user_id, authCode.scope, tokenExpiresAt], (err) => {
          if (err) {
            console.error('Error inserting token:', err);
            return res.status(500).send('Internal server error');
          }

          // Build ID token
          const base_url = req.protocol + '://' + req.get('host');
          const header = { alg: 'RS256', kid: kid };
          const payload = {
            sub: authCode.user_id.toString(),
            iss: base_url,
            aud: clientId,
            exp: tokenExpiresAt,
            iat: Math.floor(Date.now() / 1000)
          };

          const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
          const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
          const message = headerB64 + '.' + payloadB64;

          const sign = crypto.createSign('RSA-SHA256');
          sign.update(message);
          const signature = sign.sign(privateKey, 'base64url');
          const id_token = message + '.' + signature;

          // Response
          res.set('Cache-Control', 'no-store');
          res.json({
            access_token,
            id_token,
            token_type: 'Bearer',
            expires_in: 3600
          });
        });
      });
    });
  });
});

app.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.split(' ')[1];
  database.get(`SELECT * FROM access_tokens WHERE access_token = ?`, [token], (err, tokenRow) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal server error');
    }

    if (!tokenRow || tokenRow.expires_at < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    // Get user
    database.get(`SELECT * FROM user_accounts WHERE id = ?`, [tokenRow.user_id], (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal server error');
      }

      const response = { sub: user.id.toString() };
      if (tokenRow.scope.split(' ').includes('email')) {
        response.email = user.email;
      }

      res.json(response);
    });
  });
});

app.post('/userinfo', (req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.listen(serverPort, () => {
  console.log(`Server listening on port ${serverPort}`);
});
