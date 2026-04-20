import { validateClient, authenticateUser, generateAuthCode, storeAuthCode } from '../services/auth.js';

export async function getAuthorize(req, res) {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

  if (!client_id || !redirect_uri || response_type !== 'code' || !scope || !scope.includes('openid')) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const client = await validateClient(client_id, redirect_uri);
  if (!client) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  // Render login form
  const form = `
    <form method="post">
      <input type="hidden" name="client_id" value="${client_id}">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}">
      <input type="hidden" name="response_type" value="${response_type}">
      <input type="hidden" name="scope" value="${scope}">
      ${state ? `<input type="hidden" name="state" value="${state}">` : ''}
      ${code_challenge ? `<input type="hidden" name="code_challenge" value="${code_challenge}">` : ''}
      ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${code_challenge_method}">` : ''}
      <label>Username: <input type="text" name="username"></label><br>
      <label>Password: <input type="password" name="password"></label><br>
      <button type="submit">Login</button>
    </form>
  `;
  res.send(form);
}

export async function postAuthorize(req, res) {
  const { client_id, redirect_uri, response_type, scope, state, username, password, code_challenge, code_challenge_method } = req.body;

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).send('Invalid credentials');
  }

  const code = generateAuthCode();
  await storeAuthCode(code, client_id, user.id, redirect_uri, scope, state, code_challenge, code_challenge_method);

  let redirectUrl = `${redirect_uri}?code=${code}`;
  if (state) redirectUrl += `&state=${state}`;
  res.redirect(302, redirectUrl);
}