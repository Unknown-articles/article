import { getClientById, validateRedirectUri } from '../services/clientService.js';
import { getUserByCredentials } from '../services/userService.js';
import { generateAuthCode } from '../services/codeService.js';

function buildLoginForm(params, error = '') {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = params;
  const errorHtml = error ? `<p style="color:red">${error}</p>` : '';
  return `<!DOCTYPE html>
<html>
<head><title>Sign In</title></head>
<body>
  <h2>Sign In</h2>
  ${errorHtml}
  <form method="POST" action="/oauth2/authorize">
    <input type="hidden" name="client_id" value="${escHtml(client_id || '')}">
    <input type="hidden" name="redirect_uri" value="${escHtml(redirect_uri || '')}">
    <input type="hidden" name="response_type" value="${escHtml(response_type || '')}">
    <input type="hidden" name="scope" value="${escHtml(scope || '')}">
    <input type="hidden" name="state" value="${escHtml(state || '')}">
    ${code_challenge ? `<input type="hidden" name="code_challenge" value="${escHtml(code_challenge)}">` : ''}
    ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${escHtml(code_challenge_method)}">` : ''}
    <label>Username: <input type="text" name="username"></label><br>
    <label>Password: <input type="password" name="password"></label><br>
    <button type="submit">Sign In</button>
  </form>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validateAuthzParams(query) {
  const { client_id, redirect_uri, response_type, scope } = query;
  if (!client_id) return { error: 'client_id is required' };
  const client = getClientById(client_id);
  if (!client) return { error: 'Unknown client_id' };
  if (!redirect_uri) return { error: 'redirect_uri is required' };
  if (!validateRedirectUri(client, redirect_uri)) return { error: 'Invalid redirect_uri' };
  if (!response_type || response_type !== 'code') return { error: 'response_type must be code' };
  if (!scope || !scope.split(' ').includes('openid')) return { error: 'scope must include openid' };
  return { client };
}

export function getAuthorize(req, res) {
  const result = validateAuthzParams(req.query);
  if (result.error) {
    return res.status(400).json({ error: 'invalid_request', error_description: result.error });
  }
  res.send(buildLoginForm(req.query));
}

export function postAuthorize(req, res) {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;

  const result = validateAuthzParams({ client_id, redirect_uri, response_type, scope });
  if (result.error) {
    return res.status(400).json({ error: 'invalid_request', error_description: result.error });
  }

  const user = getUserByCredentials(username, password);
  if (!user) {
    return res.status(401).send(buildLoginForm(req.body, 'Invalid username or password'));
  }

  const code = generateAuthCode(client_id, user.id, redirect_uri, scope, code_challenge || null, code_challenge_method || null);

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return res.redirect(302, redirectUrl.toString());
}
