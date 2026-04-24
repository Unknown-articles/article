import express from 'express';
import { createHash, randomBytes, sign } from 'node:crypto';
import {
  flagAuthorizationCodeAsUsed,
  loadAuthorizationCode,
  loadClientByClientId,
  loadTokenByAccessToken,
  loadUserById,
  loadUserByUsername,
  prepareDatabase,
  storeAccessToken,
  storeAuthorizationCode,
} from './database.js';
import { getJwks, getSigningKey, prepareKeys } from './keys.js';

const serverApp = express();
const listeningPort = Number.parseInt(process.env.PORT ?? '3000', 10);

function resolveBaseUrl(request) {
  return `${request.protocol}://${request.get('host')}`;
}

function sanitizeHtml(rawValue = '') {
  return rawValue
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function hasOpenIdScope(scopeValue) {
  return scopeValue.split(/\s+/).includes('openid');
}

function buildLoginScreen({
  clientId,
  redirectUri,
  state = '',
  responseType,
  scope,
  codeChallenge = '',
  codeChallengeMethod = '',
  errorMessage = '',
}) {
  const pkceInputs =
    codeChallenge && codeChallengeMethod
      ? `
      <input type="hidden" name="code_challenge" value="${sanitizeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${sanitizeHtml(codeChallengeMethod)}">`
      : '';
  const feedbackBlock = errorMessage ? `
      <p role="alert">${sanitizeHtml(errorMessage)}</p>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Sign in</title>
  </head>
  <body>
    <form method="POST" action="/oauth2/authorize">
${feedbackBlock}
      <input type="hidden" name="client_id" value="${sanitizeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${sanitizeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${sanitizeHtml(state)}">
      <input type="hidden" name="response_type" value="${sanitizeHtml(responseType)}">
      <input type="hidden" name="scope" value="${sanitizeHtml(scope)}">${pkceInputs}

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

async function inspectAuthorizationRequest(params) {
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

  const client = await loadClientByClientId(clientId);
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

  const allowedRedirectUris = JSON.parse(client.redirect_uris);
  if (!allowedRedirectUris.includes(redirectUri)) {
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

  if (!scope || typeof scope !== 'string' || !hasOpenIdScope(scope)) {
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

function buildAuthorizationRedirect(redirectUri, authorizationCode, state) {
  const redirectLocation = new URL(redirectUri);
  redirectLocation.searchParams.set('code', authorizationCode);

  if (state) {
    redirectLocation.searchParams.set('state', state);
  }

  return redirectLocation.toString();
}

function decodeBasicAuthHeader(authorizationHeader = '') {
  const [scheme, encodedCredentials] = authorizationHeader.split(' ');

  if (scheme !== 'Basic' || !encodedCredentials) {
    return {};
  }

  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    return {};
  }

  return {
    clientId: decodedCredentials.slice(0, separatorIndex),
    clientSecret: decodedCredentials.slice(separatorIndex + 1),
  };
}

async function validateTokenClient(request) {
  const basicCredentials = decodeBasicAuthHeader(request.get('authorization'));
  const formClientId = typeof request.body.client_id === 'string' ? request.body.client_id : '';
  const formClientSecret =
    typeof request.body.client_secret === 'string' ? request.body.client_secret : '';
  const clientId = basicCredentials.clientId || formClientId;
  const clientSecret = basicCredentials.clientSecret || formClientSecret;

  if (!clientId) {
    return { authenticated: false };
  }

  const client = await loadClientByClientId(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return { authenticated: false };
  }

  return { authenticated: true, client };
}

function inspectTokenRequestBody(payload) {
  if (!payload.grant_type) {
    return { valid: false, status: 400, body: { error: 'invalid_request' } };
  }

  if (payload.grant_type !== 'authorization_code') {
    return { valid: false, status: 400, body: { error: 'unsupported_grant_type' } };
  }

  if (!payload.code || !payload.redirect_uri) {
    return { valid: false, status: 400, body: { error: 'invalid_request' } };
  }

  return { valid: true };
}

function encodeJsonAsBase64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function issueIdToken({ issuer, clientId, userId, now, expiresAt }) {
  const { kid, privateKey } = getSigningKey();
  const encodedHeader = encodeJsonAsBase64Url({ alg: 'RS256', kid });
  const encodedPayload = encodeJsonAsBase64Url({
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

function matchesPkceVerifier(codeVerifier, expectedChallenge) {
  return createHash('sha256').update(codeVerifier).digest('base64url') === expectedChallenge;
}

function extractBearerToken(authorizationHeader = '') {
  const [scheme, bearerToken] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !bearerToken) {
    return '';
  }

  return bearerToken;
}

serverApp.use(express.json());
serverApp.use(express.urlencoded({ extended: false }));

serverApp.use((req, res, next) => {
  res.type('application/json');
  next();
});

serverApp.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

serverApp.get('/.well-known/jwks.json', (req, res) => {
  res.status(200).json(getJwks());
});

serverApp.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = resolveBaseUrl(req);

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

serverApp.get('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await inspectAuthorizationRequest(req.query);
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
      buildLoginScreen({
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

serverApp.post('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await inspectAuthorizationRequest(req.body);
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

    const userRecord =
      typeof req.body.username === 'string'
        ? await loadUserByUsername(req.body.username)
        : null;
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!userRecord || userRecord.password !== password) {
      res.type('html').status(401).send(
        buildLoginScreen({
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

    await storeAuthorizationCode({
      code,
      clientId: validation.clientId,
      userId: userRecord.id,
      redirectUri: validation.redirectUri,
      scope: validation.scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    });

    res.redirect(302, buildAuthorizationRedirect(validation.redirectUri, code, state));
  } catch (error) {
    next(error);
  }
});

serverApp.use('/oauth2/token', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

serverApp.post('/oauth2/token', async (req, res, next) => {
  try {
    const clientAuthentication = await validateTokenClient(req);

    if (!clientAuthentication.authenticated) {
      res.status(401).json({ error: 'invalid_client' });
      return;
    }

    const validation = inspectTokenRequestBody(req.body);
    if (!validation.valid) {
      res.status(validation.status).json(validation.body);
      return;
    }

    const storedAuthorizationCode = await loadAuthorizationCode(req.body.code);
    const issuedAt = Math.floor(Date.now() / 1000);

    if (
      !storedAuthorizationCode ||
      storedAuthorizationCode.used === 1 ||
      storedAuthorizationCode.expires_at < issuedAt ||
      storedAuthorizationCode.redirect_uri !== req.body.redirect_uri ||
      storedAuthorizationCode.client_id !== clientAuthentication.client.client_id
    ) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (storedAuthorizationCode.code_challenge) {
      const codeVerifier = typeof req.body.code_verifier === 'string' ? req.body.code_verifier : '';

      if (
        !codeVerifier ||
        !matchesPkceVerifier(codeVerifier, storedAuthorizationCode.code_challenge)
      ) {
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }
    }

    await flagAuthorizationCodeAsUsed(storedAuthorizationCode.id);

    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = issuedAt + 60 * 60;

    await storeAccessToken({
      accessToken,
      clientId: storedAuthorizationCode.client_id,
      userId: storedAuthorizationCode.user_id,
      scope: storedAuthorizationCode.scope,
      expiresAt,
    });

    const idToken = issueIdToken({
      issuer: resolveBaseUrl(req),
      clientId: storedAuthorizationCode.client_id,
      userId: storedAuthorizationCode.user_id,
      now: issuedAt,
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

serverApp.get('/userinfo', async (req, res, next) => {
  try {
    const accessToken = extractBearerToken(req.get('authorization'));

    if (!accessToken) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const token = await loadTokenByAccessToken(accessToken);
    const now = Math.floor(Date.now() / 1000);

    if (!token || token.expires_at < now) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const user = await loadUserById(token.user_id);

    res.status(200).json({
      sub: String(token.user_id),
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

serverApp.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

export { serverApp as app };

await prepareDatabase();
await prepareKeys();

serverApp.listen(listeningPort, () => {
  console.log(`Server listening on port ${listeningPort}`);
});
