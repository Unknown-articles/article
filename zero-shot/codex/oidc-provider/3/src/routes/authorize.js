import { Router } from "express";
import { asyncHandler, jsonError } from "../http.js";
import {
  createAuthorizationCode,
  findClient,
  findUserByCredentials,
  hasOpenIdScope,
  redirectUriAllowed
} from "../oauth.js";

function validateAuthorizationRequest(params) {
  if (!params.client_id) return { error: "invalid_request", description: "client_id is required" };
  if (!params.redirect_uri) return { error: "invalid_request", description: "redirect_uri is required" };
  if (!params.response_type || params.response_type !== "code") {
    return { error: "unsupported_response_type", description: "response_type must be code" };
  }
  if (!params.scope || !hasOpenIdScope(params.scope)) {
    return { error: "invalid_scope", description: "scope must include openid" };
  }
  return null;
}

async function validateClientAndRedirect(params) {
  const basicError = validateAuthorizationRequest(params);
  if (basicError) return basicError;

  const client = await findClient(params.client_id);
  if (!client) return { error: "invalid_request", description: "unknown client_id" };
  if (!redirectUriAllowed(client, params.redirect_uri)) {
    return { error: "invalid_request", description: "redirect_uri is not registered for this client" };
  }

  if (params.code_challenge && params.code_challenge_method !== "S256") {
    return { error: "invalid_request", description: "code_challenge_method must be S256" };
  }

  return null;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hidden(name, value) {
  return `<input type="hidden" name="${name}" value="${escapeHtml(value || "")}">`;
}

function renderLoginForm(params, errorMessage = "") {
  const error = errorMessage ? `<p role="alert">${escapeHtml(errorMessage)}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Sign in</title>
  </head>
  <body>
    ${error}
    <form method="post" action="/oauth2/authorize">
      ${hidden("client_id", params.client_id)}
      ${hidden("redirect_uri", params.redirect_uri)}
      ${hidden("response_type", params.response_type || "code")}
      ${hidden("scope", params.scope)}
      ${hidden("state", params.state)}
      ${hidden("code_challenge", params.code_challenge)}
      ${hidden("code_challenge_method", params.code_challenge_method)}
      <label>Username <input name="username" autocomplete="username"></label>
      <label>Password <input name="password" type="password" autocomplete="current-password"></label>
      <button type="submit">Sign in</button>
    </form>
  </body>
</html>`;
}

export function authorizeRouter() {
  const router = Router();

  router.get(
    "/oauth2/authorize",
    asyncHandler(async (req, res) => {
      const validationError = await validateClientAndRedirect(req.query);
      if (validationError) {
        return jsonError(res, 400, validationError.error, validationError.description);
      }

      return res.status(200).type("html").send(renderLoginForm(req.query));
    })
  );

  router.post(
    "/oauth2/authorize",
    asyncHandler(async (req, res) => {
      const params = req.body;
      const validationError = await validateClientAndRedirect(params);
      if (validationError) {
        return jsonError(res, 400, validationError.error, validationError.description);
      }

      const user = await findUserByCredentials(params.username, params.password);
      if (!user) {
        return res.status(200).type("html").send(renderLoginForm(params, "Invalid username or password"));
      }

      const code = await createAuthorizationCode({
        clientId: params.client_id,
        userId: user.id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method
      });

      const redirectUrl = new URL(params.redirect_uri);
      redirectUrl.searchParams.set("code", code);
      if (params.state) redirectUrl.searchParams.set("state", params.state);

      return res.redirect(302, redirectUrl.toString());
    })
  );

  return router;
}
