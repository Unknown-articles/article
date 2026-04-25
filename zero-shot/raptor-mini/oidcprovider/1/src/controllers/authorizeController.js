import { findClient, validateRedirectUri, authenticateUser, createAuthorizationCode } from '../services/authService.js';
import { ALLOWED_RESPONSE_TYPES } from '../config.js';

function renderForm({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, error }) {
  const escaped = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Authorize</title>
</head>
<body>
  <h1>Authorize request</h1>
  ${error ? `<p style="color:red;">${escaped(error)}</p>` : ''}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${escaped(client_id)}" />
    <input type="hidden" name="redirect_uri" value="${escaped(redirect_uri)}" />
    <input type="hidden" name="response_type" value="${escaped(response_type)}" />
    <input type="hidden" name="scope" value="${escaped(scope)}" />
    <input type="hidden" name="state" value="${escaped(state)}" />
    <input type="hidden" name="code_challenge" value="${escaped(code_challenge)}" />
    <input type="hidden" name="code_challenge_method" value="${escaped(code_challenge_method)}" />
    <label>
      Username:<br />
      <input type="text" name="username" value="" required />
    </label>
    <br />
    <label>
      Password:<br />
      <input type="password" name="password" required />
    </label>
    <br />
    <button type="submit">Login</button>
  </form>
</body>
</html>`;
}

function validateAuthorizeRequest({ client_id, redirect_uri, response_type, scope }) {
  if (!client_id) {
    return 'client_id is required';
  }
  if (!redirect_uri) {
    return 'redirect_uri is required';
  }
  if (!response_type || !ALLOWED_RESPONSE_TYPES.includes(response_type)) {
    return 'response_type must be code';
  }
  if (!scope || !scope.split(' ').includes('openid')) {
    return 'scope must include openid';
  }
  return null;
}

export async function authorizeGet(req, res) {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;
  const validationError = validateAuthorizeRequest({ client_id, redirect_uri, response_type, scope });
  if (validationError) {
    return res.status(400).json({ error: 'invalid_request', error_description: validationError });
  }

  const client = await findClient(client_id);
  if (!client || !validateRedirectUri(client, redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid client_id or redirect_uri' });
  }

  res.type('html').send(renderForm({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method }));
}

export async function authorizePost(req, res) {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;
  const validationError = validateAuthorizeRequest({ client_id, redirect_uri, response_type, scope });
  if (validationError) {
    return res.status(400).json({ error: 'invalid_request', error_description: validationError });
  }

  const client = await findClient(client_id);
  if (!client || !validateRedirectUri(client, redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid client_id or redirect_uri' });
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.type('html').send(renderForm({ client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, error: 'Invalid username or password' }));
  }

  const code = await createAuthorizationCode({
    client_id,
    redirect_uri,
    user_id: user.id,
    scope,
    code_challenge,
    code_challenge_method
  });

  const params = new URLSearchParams({ code });
  if (state) params.set('state', state);
  res.redirect(`${redirect_uri}?${params.toString()}`);
}
