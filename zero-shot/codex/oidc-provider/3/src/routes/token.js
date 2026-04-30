import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { SignJWT } from "jose";
import { ACCESS_TOKEN_TTL_SECONDS, ISSUER } from "../config.js";
import { database } from "../db.js";
import { asyncHandler, jsonError } from "../http.js";
import { getActiveSigningKey } from "../keys.js";
import {
  createAccessToken,
  findAuthorizationCode,
  findClient,
  markAuthorizationCodeUsed,
  now,
  pkceChallengeS256,
  redirectUriAllowed
} from "../oauth.js";

function parseBasicAuth(header = "") {
  const [scheme, credentials] = header.split(" ");
  if (scheme !== "Basic" || !credentials) return {};

  try {
    const decoded = Buffer.from(credentials, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) return {};
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1)
    };
  } catch {
    return {};
  }
}

function secretMatches(actual = "", expected = "") {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function authenticateClient(req) {
  const basic = parseBasicAuth(req.get("authorization"));
  const clientId = basic.clientId || req.body.client_id;
  const clientSecret = basic.clientSecret || req.body.client_secret;

  if (!clientId || !clientSecret) return undefined;

  const client = await findClient(clientId);
  if (!client || !secretMatches(clientSecret, client.client_secret)) return undefined;
  return client;
}

async function createIdToken({ code, clientId }) {
  const { kid, privateKey } = await getActiveSigningKey();
  const issuedAt = now();

  return new SignJWT({
    sub: code.sub,
    iss: ISSUER,
    aud: clientId
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .sign(privateKey);
}

export function tokenRouter() {
  const router = Router();

  router.post(
    "/oauth2/token",
    asyncHandler(async (req, res) => {
      const { grant_type: grantType, code, redirect_uri: redirectUri, code_verifier: codeVerifier } = req.body;

      if (!grantType) return jsonError(res, 400, "invalid_request", "grant_type is required");
      if (grantType !== "authorization_code") return jsonError(res, 400, "unsupported_grant_type");
      if (!code) return jsonError(res, 400, "invalid_request", "code is required");
      if (!redirectUri) return jsonError(res, 400, "invalid_request", "redirect_uri is required");

      const client = await authenticateClient(req);
      if (!client) return jsonError(res, 401, "invalid_client");

      if (!redirectUriAllowed(client, redirectUri)) return jsonError(res, 400, "invalid_grant");

      const authorizationCode = await findAuthorizationCode(code);
      if (!authorizationCode) return jsonError(res, 400, "invalid_grant");
      if (authorizationCode.used_at) return jsonError(res, 400, "invalid_grant");
      if (authorizationCode.expires_at <= now()) return jsonError(res, 400, "invalid_grant");
      if (authorizationCode.client_id !== client.client_id) return jsonError(res, 400, "invalid_grant");
      if (authorizationCode.redirect_uri !== redirectUri) return jsonError(res, 400, "invalid_grant");

      if (authorizationCode.code_challenge) {
        if (authorizationCode.code_challenge_method !== "S256") return jsonError(res, 400, "invalid_grant");
        if (!codeVerifier || pkceChallengeS256(codeVerifier) !== authorizationCode.code_challenge) {
          return jsonError(res, 400, "invalid_grant");
        }
      }

      await markAuthorizationCodeUsed(code);

      const { accessToken, expiresIn } = await createAccessToken({
        clientId: client.client_id,
        userId: authorizationCode.user_id,
        scope: authorizationCode.scope
      });
      const idToken = await createIdToken({ code: authorizationCode, clientId: client.client_id });

      await database.run("DELETE FROM authorization_codes WHERE expires_at <= ?", [now()]);

      return res
        .status(200)
        .set("Cache-Control", "no-store")
        .type("application/json")
        .json({
          access_token: accessToken,
          id_token: idToken,
          token_type: "Bearer",
          expires_in: expiresIn
        });
    })
  );

  return router;
}
