import { Router } from 'express';
import { asyncHandler, jsonError } from '../errors.js';
import {
  createAuthorizationCode,
  findClient,
  findUserByCredentials,
  isRedirectUriAllowed,
  scopeIncludes
} from '../services/oauth.js';

export const authorizeRouter = Router();

authorizeRouter.get('/oauth2/authorize', asyncHandler(async (req, res) => {
  const validation = await validateAuthorizeRequest(req.query);
  if (validation.error) {
    return jsonError(res, 400, 'invalid_request', validation.error);
  }

  return renderLoginForm(res, req.query);
}));

authorizeRouter.post('/oauth2/authorize', asyncHandler(async (req, res) => {
  const validation = await validateAuthorizeRequest(req.body);
  if (validation.error) {
    return jsonError(res, 400, 'invalid_request', validation.error);
  }

  const user = await findUserByCredentials(req.body.username, req.body.password);
  if (!user) {
    return renderLoginForm(res.status(401), req.body, 'Invalid username or password');
  }

  if (req.body.code_challenge_method && req.body.code_challenge_method !== 'S256') {
    return renderLoginForm(res.status(400), req.body, 'Invalid PKCE code challenge method');
  }

  const code = await createAuthorizationCode({
    clientId: req.body.client_id,
    userId: user.id,
    redirectUri: req.body.redirect_uri,
    scope: req.body.scope,
    codeChallenge: req.body.code_challenge,
    codeChallengeMethod: req.body.code_challenge_method
  });

  const redirectUrl = new URL(req.body.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (req.body.state) {
    redirectUrl.searchParams.set('state', req.body.state);
  }

  return res.redirect(302, redirectUrl.toString());
}));

async function validateAuthorizeRequest(params) {
  const clientId = params.client_id;
  const redirectUri = params.redirect_uri;
  const responseType = params.response_type;
  const scope = params.scope;

  if (!clientId) {
    return { error: 'client_id is required' };
  }

  const client = await findClient(clientId);
  if (!client) {
    return { error: 'unknown client_id' };
  }

  if (!redirectUri || !isRedirectUriAllowed(client, redirectUri)) {
    return { error: 'redirect_uri is missing or not registered for this client' };
  }

  if (responseType !== 'code') {
    return { error: 'response_type must be code' };
  }

  if (!scopeIncludes(scope, 'openid')) {
    return { error: 'scope must include openid' };
  }

  return { client };
}

function renderLoginForm(res, params, errorMessage = '') {
  const hiddenFields = [
    'client_id',
    'redirect_uri',
    'response_type',
    'scope',
    'state',
    'code_challenge',
    'code_challenge_method'
  ]
    .map((name) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(params[name] || '')}">`)
    .join('\n');

  const errorMarkup = errorMessage ? `<p role="alert">${escapeHtml(errorMessage)}</p>` : '';

  return res
    .type('html')
    .send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Sign in</title></head>
<body>
  <main>
    <h1>Sign in</h1>
    ${errorMarkup}
    <form method="post" action="/oauth2/authorize">
      ${hiddenFields}
      <label>Username <input name="username" autocomplete="username" required></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Authorize</button>
    </form>
  </main>
</body>
</html>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
