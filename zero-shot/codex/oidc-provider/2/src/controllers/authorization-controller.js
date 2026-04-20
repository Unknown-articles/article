import { createAuthorizationCode, validateAuthorizationRequest } from '../services/authorization-service.js';
import { authenticateUser } from '../services/user-service.js';
import { escapeHtml } from '../utils/html.js';

function renderLoginPage(params, errorMessage = '') {
  const hiddenValue = (value) => escapeHtml(value ?? '');
  const errorBlock = errorMessage
    ? `<p style="color: red;">${escapeHtml(errorMessage)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OIDC Login</title>
  </head>
  <body>
    <h1>Sign in</h1>
    ${errorBlock}
    <form method="post" action="/oauth2/authorize">
      <input type="hidden" name="client_id" value="${hiddenValue(params.client_id)}" />
      <input type="hidden" name="redirect_uri" value="${hiddenValue(params.redirect_uri)}" />
      <input type="hidden" name="response_type" value="${hiddenValue(params.response_type)}" />
      <input type="hidden" name="scope" value="${hiddenValue(params.scope)}" />
      <input type="hidden" name="state" value="${hiddenValue(params.state)}" />
      <input type="hidden" name="code_challenge" value="${hiddenValue(params.code_challenge)}" />
      <input type="hidden" name="code_challenge_method" value="${hiddenValue(params.code_challenge_method)}" />
      <label for="username">Username</label>
      <input id="username" name="username" type="text" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" />
      <button type="submit">Authorize</button>
    </form>
  </body>
</html>`;
}

export async function getAuthorizationPage(req, res) {
  const validation = await validateAuthorizationRequest(req.query);

  if (!validation.valid) {
    res.status(400).json({
      error: validation.error,
      error_description: validation.message,
    });
    return;
  }

  res.type('text/html').status(200).send(renderLoginPage(req.query));
}

export async function authorizeUser(req, res) {
  const validation = await validateAuthorizationRequest(req.body);

  if (!validation.valid) {
    res.status(400).json({
      error: validation.error,
      error_description: validation.message,
    });
    return;
  }

  const user = await authenticateUser(req.body.username, req.body.password);

  if (!user) {
    res
      .type('text/html')
      .status(401)
      .send(renderLoginPage(req.body, 'Invalid username or password.'));
    return;
  }

  const code = await createAuthorizationCode({
    client: validation.client,
    user,
    redirectUri: req.body.redirect_uri,
    scope: req.body.scope,
    state: req.body.state,
    codeChallenge: req.body.code_challenge,
    codeChallengeMethod: req.body.code_challenge_method,
  });

  const redirectUrl = new URL(req.body.redirect_uri);
  redirectUrl.searchParams.set('code', code);

  if (req.body.state) {
    redirectUrl.searchParams.set('state', req.body.state);
  }

  res.redirect(302, redirectUrl.toString());
}
