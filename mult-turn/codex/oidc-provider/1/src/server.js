import express from 'express';
import { createHash, randomBytes, sign } from 'node:crypto';
import {
  createAuthorizationCode,
  createToken,
  findAuthorizationCode,
  findClientByClientId,
  findToken,
  findUserById,
  findUserByUsername,
  initializeDatabase,
  markAuthorizationCodeUsed,
} from './database.js';
import { getJwks, getSigningKey, initializeKeys } from './keys.js';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function scopeIncludesOpenid(scope) {
  return scope.split(/\s+/).includes('openid');
}

function renderLoginForm({
  clientId,
  redirectUri,
  state = '',
  responseType,
  scope,
  codeChallenge = '',
  codeChallengeMethod = '',
  errorMessage = '',
}) {
  const pkceFields =
    codeChallenge && codeChallengeMethod
      ? `
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">`
      : '';
  const errorBlock = errorMessage ? `
      <p role="alert">${escapeHtml(errorMessage)}</p>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Sign in</title>
  </head>
  <body>
    <form method="POST" action="/oauth2/authorize">
${errorBlock}
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <input type="hidden" name="response_type" value="${escapeHtml(responseType)}">
      <input type="hidden" name="scope" value="${escapeHtml(scope)}">${pkceFields}

      <label>
        Username
        <input name="username" autocomplete="username" required>
      </label>

      <label>
        Password
        <input name="password" type="password" autocomplete="current-password" required>
      </label>

      <button type="submit">Sign in</button>
    </form>
  </body>
</html>`;
}

async function validateAuthorizationParams(params) {
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope,
  } = params;

  if (!clientId || typeof clientId !== 'string') {
    return {
      valid: false,
      status: 400,
      body: { error: 'invalid_request', error_description: 'client_id is required' },
    };
  }

  const client = await findClientByClientId(clientId);
  if (!client) {
    return {
      valid: false,
      status: 400,
      body: { error: 'invalid_client', error_description: 'client_id was not found' },
    };
  }

  if (!redirectUri || typeof redirectUri !== 'string') {
    return {
      valid: false,
      status: 400,
      body: { error: 'invalid_request', error_description: 'redirect_uri is required' },
    };
  }

  const redirectUris = JSON.parse(client.redirect_uris);
  if (!redirectUris.includes(redirectUri)) {
    return {
      valid: false,
      status: 400,
      body: { error: 'invalid_request', error_description: 'redirect_uri is not registered' },
    };
  }

  if (responseType !== 'code') {
    return {
      valid: false,
      status: 400,
      body: {
        error: 'unsupported_response_type',
        error_description: 'response_type must be code',
      },
    };
  }

  if (!scope || typeof scope !== 'string' || !scopeIncludesOpenid(scope)) {
    return {
      valid: false,
      status: 400,
      body: { error: 'invalid_scope', error_description: 'scope must include openid' },
    };
  }

  return {
    valid: true,
    clientId,
    redirectUri,
    responseType,
    scope,
  };
}

function createAuthorizationRedirect(redirectUri, code, state) {
  const location = new URL(redirectUri);
  location.searchParams.set('code', code);

  if (state) {
    location.searchParams.set('state', state);
  }

  return location.toString();
}

function parseBasicAuth(authorizationHeader = '') {
  const [scheme, credentials] = authorizationHeader.split(' ');

  if (scheme !== 'Basic' || !credentials) {
    return {};
  }

  const decoded = Buffer.from(credentials, 'base64').toString('utf8');
  const colonIndex = decoded.indexOf(':');

  if (colonIndex === -1) {
    return {};
  }

  return {
    clientId: decoded.slice(0, colonIndex),
    clientSecret: decoded.slice(colonIndex + 1),
  };
}

async function authenticateTokenClient(req) {
  const basicAuth = parseBasicAuth(req.get('authorization'));
  const bodyClientId = typeof req.body.client_id === 'string' ? req.body.client_id : '';
  const bodyClientSecret =
    typeof req.body.client_secret === 'string' ? req.body.client_secret : '';
  const clientId = basicAuth.clientId || bodyClientId;
  const clientSecret = basicAuth.clientSecret || bodyClientSecret;

  if (!clientId) {
    return { authenticated: false };
  }

  const client = await findClientByClientId(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return { authenticated: false };
  }

  return { authenticated: true, client };
}

function validateTokenRequestBody(body) {
  if (!body.grant_type) {
    return { valid: false, status: 400, body: { error: 'invalid_request' } };
  }

  if (body.grant_type !== 'authorization_code') {
    return { valid: false, status: 400, body: { error: 'unsupported_grant_type' } };
  }

  if (!body.code || !body.redirect_uri) {
    return { valid: false, status: 400, body: { error: 'invalid_request' } };
  }

  return { valid: true };
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createIdToken({ issuer, clientId, userId, now, expiresAt }) {
  const { kid, privateKey } = getSigningKey();
  const encodedHeader = base64urlJson({ alg: 'RS256', kid });
  const encodedPayload = base64urlJson({
    sub: String(userId),
    iss: issuer,
    aud: clientId,
    exp: expiresAt,
    iat: now,
  });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');

  return `${signingInput}.${signature}`;
}

function verifyPkce(codeVerifier, codeChallenge) {
  return createHash('sha256').update(codeVerifier).digest('base64url') === codeChallenge;
}

function parseBearerToken(authorizationHeader = '') {
  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token;
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.type('application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.status(200).json(getJwks());
});

app.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = getBaseUrl(req);

  res.status(200).json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth2/authorize`,
    token_endpoint: `${baseUrl}/oauth2/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
});

app.get('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await validateAuthorizationParams(req.query);
    const state = req.query.state ?? '';
    const codeChallenge =
      typeof req.query.code_challenge === 'string' ? req.query.code_challenge : '';
    const codeChallengeMethod =
      typeof req.query.code_challenge_method === 'string' ? req.query.code_challenge_method : '';

    if (!validation.valid) {
      res.status(validation.status).json(validation.body);
      return;
    }

    res.type('html').status(200).send(
      renderLoginForm({
        clientId: validation.clientId,
        redirectUri: validation.redirectUri,
        state: typeof state === 'string' ? state : '',
        responseType: validation.responseType,
        scope: validation.scope,
        codeChallenge,
        codeChallengeMethod,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await validateAuthorizationParams(req.body);
    const state = typeof req.body.state === 'string' ? req.body.state : '';
    const hasS256Pkce =
      typeof req.body.code_challenge === 'string' &&
      req.body.code_challenge &&
      req.body.code_challenge_method === 'S256';
    const codeChallenge = hasS256Pkce ? req.body.code_challenge : null;
    const codeChallengeMethod = hasS256Pkce ? req.body.code_challenge_method : null;

    if (!validation.valid) {
      res.status(validation.status).json(validation.body);
      return;
    }

    const user =
      typeof req.body.username === 'string'
        ? await findUserByUsername(req.body.username)
        : null;
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!user || user.password !== password) {
      res.type('html').status(401).send(
        renderLoginForm({
          clientId: validation.clientId,
          redirectUri: validation.redirectUri,
          state,
          responseType: validation.responseType,
          scope: validation.scope,
          codeChallenge: codeChallenge ?? '',
          codeChallengeMethod: codeChallengeMethod ?? '',
          errorMessage: 'Invalid username or password',
        }),
      );
      return;
    }

    const code = randomBytes(32).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;

    await createAuthorizationCode({
      code,
      clientId: validation.clientId,
      userId: user.id,
      redirectUri: validation.redirectUri,
      scope: validation.scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    });

    res.redirect(302, createAuthorizationRedirect(validation.redirectUri, code, state));
  } catch (error) {
    next(error);
  }
});

app.use('/oauth2/token', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.post('/oauth2/token', async (req, res, next) => {
  try {
    const clientAuthentication = await authenticateTokenClient(req);

    if (!clientAuthentication.authenticated) {
      res.status(401).json({ error: 'invalid_client' });
      return;
    }

    const validation = validateTokenRequestBody(req.body);
    if (!validation.valid) {
      res.status(validation.status).json(validation.body);
      return;
    }

    const authCode = await findAuthorizationCode(req.body.code);
    const now = Math.floor(Date.now() / 1000);

    if (
      !authCode ||
      authCode.used === 1 ||
      authCode.expires_at < now ||
      authCode.redirect_uri !== req.body.redirect_uri ||
      authCode.client_id !== clientAuthentication.client.client_id
    ) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (authCode.code_challenge) {
      const codeVerifier = typeof req.body.code_verifier === 'string' ? req.body.code_verifier : '';

      if (!codeVerifier || !verifyPkce(codeVerifier, authCode.code_challenge)) {
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }
    }

    await markAuthorizationCodeUsed(authCode.id);

    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = now + 60 * 60;

    await createToken({
      accessToken,
      clientId: authCode.client_id,
      userId: authCode.user_id,
      scope: authCode.scope,
      expiresAt,
    });

    const idToken = createIdToken({
      issuer: getBaseUrl(req),
      clientId: authCode.client_id,
      userId: authCode.user_id,
      now,
      expiresAt,
    });

    res.status(200).json({
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/userinfo', async (req, res, next) => {
  try {
    const accessToken = parseBearerToken(req.get('authorization'));

    if (!accessToken) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const token = await findToken(accessToken);
    const now = Math.floor(Date.now() / 1000);

    if (!token || token.expires_at < now) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const user = await findUserById(token.user_id);

    res.status(200).json({
      sub: String(token.user_id),
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

export { app };

await initializeDatabase();
await initializeKeys();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
