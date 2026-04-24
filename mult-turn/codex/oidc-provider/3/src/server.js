import express from 'express';
import { createHash, randomBytes, sign } from 'node:crypto';
import {
  bootDatabase,
  consumeAuthorizationCode,
  fetchAuthorizationCode,
  fetchClientRecord,
  fetchTokenRecord,
  fetchUserRecordById,
  fetchUserRecordByUsername,
  insertAccessToken,
  insertAuthorizationCode,
} from './database.js';
import { getJwks, getSigningKey, warmUpKeys } from './keys.js';

const oidcService = express();
const servicePort = Number.parseInt(process.env.PORT ?? '3000', 10);

function composeIssuerUrl(httpRequest) {
  return `${httpRequest.protocol}://${httpRequest.get('host')}`;
}

function htmlEscape(inputValue = '') {
  return inputValue
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function containsOpenIdScope(scopeText) {
  return scopeText.split(/\s+/).includes('openid');
}

function renderAuthorizationLogin({
  clientId,
  redirectUri,
  state = '',
  responseType,
  scope,
  codeChallenge = '',
  codeChallengeMethod = '',
  errorMessage = '',
}) {
  const pkceMarkup =
    codeChallenge && codeChallengeMethod
      ? `
      <input type="hidden" name="code_challenge" value="${htmlEscape(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${htmlEscape(codeChallengeMethod)}">`
      : '';
  const errorMarkup = errorMessage ? `
      <p role="alert">${htmlEscape(errorMessage)}</p>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Sign in</title>
  </head>
  <body>
    <form method="POST" action="/oauth2/authorize">
${errorMarkup}
      <input type="hidden" name="client_id" value="${htmlEscape(clientId)}">
      <input type="hidden" name="redirect_uri" value="${htmlEscape(redirectUri)}">
      <input type="hidden" name="state" value="${htmlEscape(state)}">
      <input type="hidden" name="response_type" value="${htmlEscape(responseType)}">
      <input type="hidden" name="scope" value="${htmlEscape(scope)}">${pkceMarkup}

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

async function verifyAuthorizationPayload(params) {
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

  const client = await fetchClientRecord(clientId);
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

  const registeredRedirectUris = JSON.parse(client.redirect_uris);
  if (!registeredRedirectUris.includes(redirectUri)) {
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

  if (!scope || typeof scope !== 'string' || !containsOpenIdScope(scope)) {
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

function createCallbackRedirect(redirectUri, authorizationCode, state) {
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', authorizationCode);

  if (state) {
    callbackUrl.searchParams.set('state', state);
  }

  return callbackUrl.toString();
}

function readBasicCredentials(authorizationHeader = '') {
  const [scheme, encodedValue] = authorizationHeader.split(' ');

  if (scheme !== 'Basic' || !encodedValue) {
    return {};
  }

  const decodedPair = Buffer.from(encodedValue, 'base64').toString('utf8');
  const delimiterIndex = decodedPair.indexOf(':');

  if (delimiterIndex === -1) {
    return {};
  }

  return {
    clientId: decodedPair.slice(0, delimiterIndex),
    clientSecret: decodedPair.slice(delimiterIndex + 1),
  };
}

async function authenticateClientForToken(httpRequest) {
  const basicAuth = readBasicCredentials(httpRequest.get('authorization'));
  const requestClientId =
    typeof httpRequest.body.client_id === 'string' ? httpRequest.body.client_id : '';
  const requestClientSecret =
    typeof httpRequest.body.client_secret === 'string' ? httpRequest.body.client_secret : '';
  const clientId = basicAuth.clientId || requestClientId;
  const clientSecret = basicAuth.clientSecret || requestClientSecret;

  if (!clientId) {
    return { authenticated: false };
  }

  const client = await fetchClientRecord(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return { authenticated: false };
  }

  return { authenticated: true, client };
}

function validateTokenPayload(body) {
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

function stringifyAsBase64Url(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function buildIdToken({ issuer, clientId, userId, now, expiresAt }) {
  const { kid, privateKey } = getSigningKey();
  const encodedHeader = stringifyAsBase64Url({ alg: 'RS256', kid });
  const encodedPayload = stringifyAsBase64Url({
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

function validatePkceVerifier(codeVerifier, expectedChallenge) {
  return createHash('sha256').update(codeVerifier).digest('base64url') === expectedChallenge;
}

function getBearerCredential(authorizationHeader = '') {
  const [scheme, tokenValue] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !tokenValue) {
    return '';
  }

  return tokenValue;
}

oidcService.use(express.json());
oidcService.use(express.urlencoded({ extended: false }));

oidcService.use((req, res, next) => {
  res.type('application/json');
  next();
});

oidcService.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

oidcService.get('/.well-known/jwks.json', (req, res) => {
  res.status(200).json(getJwks());
});

oidcService.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = composeIssuerUrl(req);

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

oidcService.get('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await verifyAuthorizationPayload(req.query);
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
      renderAuthorizationLogin({
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

oidcService.post('/oauth2/authorize', async (req, res, next) => {
  try {
    const validation = await verifyAuthorizationPayload(req.body);
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

    const authenticatedUser =
      typeof req.body.username === 'string'
        ? await fetchUserRecordByUsername(req.body.username)
        : null;
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!authenticatedUser || authenticatedUser.password !== password) {
      res.type('html').status(401).send(
        renderAuthorizationLogin({
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

    await insertAuthorizationCode({
      code,
      clientId: validation.clientId,
      userId: authenticatedUser.id,
      redirectUri: validation.redirectUri,
      scope: validation.scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    });

    res.redirect(302, createCallbackRedirect(validation.redirectUri, code, state));
  } catch (error) {
    next(error);
  }
});

oidcService.use('/oauth2/token', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

oidcService.post('/oauth2/token', async (req, res, next) => {
  try {
    const clientAuthentication = await authenticateClientForToken(req);

    if (!clientAuthentication.authenticated) {
      res.status(401).json({ error: 'invalid_client' });
      return;
    }

    const validation = validateTokenPayload(req.body);
    if (!validation.valid) {
      res.status(validation.status).json(validation.body);
      return;
    }

    const storedCode = await fetchAuthorizationCode(req.body.code);
    const currentEpoch = Math.floor(Date.now() / 1000);

    if (
      !storedCode ||
      storedCode.used === 1 ||
      storedCode.expires_at < currentEpoch ||
      storedCode.redirect_uri !== req.body.redirect_uri ||
      storedCode.client_id !== clientAuthentication.client.client_id
    ) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (storedCode.code_challenge) {
      const codeVerifier = typeof req.body.code_verifier === 'string' ? req.body.code_verifier : '';

      if (!codeVerifier || !validatePkceVerifier(codeVerifier, storedCode.code_challenge)) {
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }
    }

    await consumeAuthorizationCode(storedCode.id);

    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = currentEpoch + 60 * 60;

    await insertAccessToken({
      accessToken,
      clientId: storedCode.client_id,
      userId: storedCode.user_id,
      scope: storedCode.scope,
      expiresAt,
    });

    const idToken = buildIdToken({
      issuer: composeIssuerUrl(req),
      clientId: storedCode.client_id,
      userId: storedCode.user_id,
      now: currentEpoch,
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

oidcService.get('/userinfo', async (req, res, next) => {
  try {
    const accessToken = getBearerCredential(req.get('authorization'));

    if (!accessToken) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const token = await fetchTokenRecord(accessToken);
    const now = Math.floor(Date.now() / 1000);

    if (!token || token.expires_at < now) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const user = await fetchUserRecordById(token.user_id);

    res.status(200).json({
      sub: String(token.user_id),
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

oidcService.post('/userinfo', (req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

export { oidcService as app };

await bootDatabase();
await warmUpKeys();

oidcService.listen(servicePort, () => {
  console.log(`Server listening on port ${servicePort}`);
});
