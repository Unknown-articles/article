import crypto from "node:crypto";
import { database } from "./db.js";
import { ACCESS_TOKEN_TTL_SECONDS, AUTH_CODE_TTL_SECONDS } from "./config.js";

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function parseScopes(scope = "") {
  return scope.split(/\s+/).filter(Boolean);
}

export function hasOpenIdScope(scope) {
  return parseScopes(scope).includes("openid");
}

export async function findClient(clientId) {
  const client = await database.get("SELECT * FROM clients WHERE client_id = ?", [clientId]);
  if (!client) return undefined;
  return {
    ...client,
    redirect_uris: JSON.parse(client.redirect_uris)
  };
}

export function redirectUriAllowed(client, redirectUri) {
  return client.redirect_uris.includes(redirectUri);
}

export async function findUserByCredentials(username, password) {
  return database.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
}

export async function createAuthorizationCode({
  clientId,
  userId,
  redirectUri,
  scope,
  codeChallenge,
  codeChallengeMethod
}) {
  const code = randomToken(32);
  const issuedAt = now();
  await database.run(
    `INSERT INTO authorization_codes
       (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      codeChallenge || null,
      codeChallengeMethod || null,
      issuedAt + AUTH_CODE_TTL_SECONDS,
      issuedAt
    ]
  );
  return code;
}

export async function findAuthorizationCode(code) {
  return database.get(
    `SELECT authorization_codes.*, users.sub, users.email, users.name
     FROM authorization_codes
     JOIN users ON users.id = authorization_codes.user_id
     WHERE authorization_codes.code = ?`,
    [code]
  );
}

export async function markAuthorizationCodeUsed(code) {
  await database.run("UPDATE authorization_codes SET used_at = ? WHERE code = ?", [now(), code]);
}

export function pkceChallengeS256(codeVerifier = "") {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export async function createAccessToken({ clientId, userId, scope }) {
  const accessToken = randomToken(32);
  const issuedAt = now();
  await database.run(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accessToken, clientId, userId, scope, issuedAt + ACCESS_TOKEN_TTL_SECONDS, issuedAt]
  );
  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
