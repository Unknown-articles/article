function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLoginPage(params) {
  const fields = {
    clientId: escapeHtml(params.clientId),
    redirectUri: escapeHtml(params.redirectUri),
    scope: escapeHtml(params.scope || 'openid'),
    state: escapeHtml(params.state),
    codeChallenge: escapeHtml(params.codeChallenge),
    codeChallengeMethod: escapeHtml(params.codeChallengeMethod),
    error: escapeHtml(params.error),
  };

  return `<!DOCTYPE html>
<html>
<head><title>Login</title>
<style>
  body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5; }
  .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.15); width: 320px; }
  h2 { margin: 0 0 1.5rem; text-align: center; }
  input { display: block; width: 100%; padding: .5rem; margin: .5rem 0 1rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
  button { width: 100%; padding: .6rem; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
  .err { color: red; font-size: .85rem; margin-bottom: .5rem; min-height: 1rem; }
</style>
</head>
<body>
<div class="card">
  <h2>Sign In</h2>
  <div class="err" id="err">${fields.error}</div>
  <form method="POST" action="/oauth2/login">
    <input type="hidden" name="client_id" value="${fields.clientId}">
    <input type="hidden" name="redirect_uri" value="${fields.redirectUri}">
    <input type="hidden" name="scope" value="${fields.scope}">
    <input type="hidden" name="state" value="${fields.state}">
    <input type="hidden" name="code_challenge" value="${fields.codeChallenge}">
    <input type="hidden" name="code_challenge_method" value="${fields.codeChallengeMethod}">
    <label>Username or Email</label>
    <input type="text" name="login" required autofocus>
    <label>Password</label>
    <input type="password" name="password" required>
    <button type="submit">Continue</button>
  </form>
</div>
</body></html>`;
}
