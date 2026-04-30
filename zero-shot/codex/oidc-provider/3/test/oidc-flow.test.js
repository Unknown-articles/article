import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createRemoteJWKSet, jwtVerify } from "jose";

process.env.PORT = "4010";
process.env.ISSUER = "http://localhost:4010";
process.env.DB_PATH = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "oidc-provider-")), "test.db");

const { initDb, database } = await import("../src/db.js");
const { ensureSigningKey } = await import("../src/keys.js");
const { createApp } = await import("../src/app.js");

let server;

before(async () => {
  await initDb();
  await ensureSigningKey();
  const app = createApp();
  server = await new Promise((resolve) => {
    const listener = app.listen(4010, () => resolve(listener));
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await database.close();
});

test("authorization code flow issues verifiable tokens and userinfo claims", async () => {
  const discovery = await fetch("http://localhost:4010/.well-known/openid-configuration");
  assert.equal(discovery.status, 200);
  const metadata = await discovery.json();
  assert.equal(metadata.issuer, "http://localhost:4010");
  assert.ok(metadata.response_types_supported.includes("code"));

  const jwks = await fetch("http://localhost:4010/.well-known/jwks.json");
  assert.equal(jwks.status, 200);
  assert.ok((await jwks.json()).keys.length >= 1);

  const authorizePage = await fetch(
    "http://localhost:4010/oauth2/authorize?client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&response_type=code&scope=openid%20email&state=abc"
  );
  assert.equal(authorizePage.status, 200);
  assert.match(await authorizePage.text(), /name="client_id"/);

  const login = await fetch("http://localhost:4010/oauth2/authorize", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "test-client",
      redirect_uri: "http://localhost:8080/callback",
      response_type: "code",
      scope: "openid email",
      state: "abc",
      username: "testuser",
      password: "password123"
    })
  });
  assert.equal(login.status, 302);

  const redirect = new URL(login.headers.get("location"));
  const code = redirect.searchParams.get("code");
  assert.ok(code);
  assert.equal(redirect.searchParams.get("state"), "abc");

  const token = await fetch("http://localhost:4010/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://localhost:8080/callback",
      client_id: "test-client",
      client_secret: "test-secret"
    })
  });
  assert.equal(token.status, 200);
  assert.equal(token.headers.get("cache-control"), "no-store");

  const tokenBody = await token.json();
  assert.equal(tokenBody.token_type, "Bearer");
  assert.equal(tokenBody.id_token.split(".").length, 3);

  const jwksClient = createRemoteJWKSet(new URL("http://localhost:4010/.well-known/jwks.json"));
  const verified = await jwtVerify(tokenBody.id_token, jwksClient, {
    issuer: "http://localhost:4010",
    audience: "test-client"
  });
  assert.equal(verified.payload.sub, "user-testuser");

  const replay = await fetch("http://localhost:4010/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://localhost:8080/callback",
      client_id: "test-client",
      client_secret: "test-secret"
    })
  });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, "invalid_grant");

  const userinfo = await fetch("http://localhost:4010/userinfo", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` }
  });
  assert.equal(userinfo.status, 200);
  assert.deepEqual(await userinfo.json(), {
    sub: "user-testuser",
    email: "testuser@example.com"
  });
});
