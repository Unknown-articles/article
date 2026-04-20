## Turn 1 — Project setup + database schema + seeding

```
Create a Node.js project using ES Modules (not CommonJS) with Express and SQLite3.

Project requirements:
- Server listens on port 3000 (configurable via PORT env var)
- All JSON responses must set Content-Type: application/json
- Use Git for source control (one commit per feature)

Database schema — create and initialize all tables on startup:
  users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    email     TEXT NOT NULL
  )
  clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      TEXT UNIQUE NOT NULL,
    client_secret  TEXT NOT NULL,
    redirect_uris  TEXT NOT NULL   ← store as JSON string
  )
  auth_codes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    code                  TEXT UNIQUE NOT NULL,
    client_id             TEXT NOT NULL,
    user_id               INTEGER NOT NULL,
    redirect_uri          TEXT NOT NULL,
    scope                 TEXT NOT NULL,
    code_challenge        TEXT,
    code_challenge_method TEXT,
    expires_at            INTEGER NOT NULL,   ← Unix timestamp
    used                  INTEGER DEFAULT 0   ← 0 = false, 1 = true
  )
  tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token  TEXT UNIQUE NOT NULL,
    client_id     TEXT NOT NULL,
    user_id       INTEGER NOT NULL,
    scope         TEXT NOT NULL,
    expires_at    INTEGER NOT NULL
  )

Seed the database on startup (skip if already present):
  Client:
    client_id:     "test-client"
    client_secret: "test-secret"
    redirect_uris: ["http://localhost:8080/callback", "http://localhost:3001/callback"]

  User:
    username: "testuser"
    password: "password123"
    email:    "testuser@example.com"

Implement one endpoint to confirm the server is running:
  GET /health
    200: { status: "ok" }

The server must start cleanly and respond to GET /health at the end of this step.
- Use Git for source control (one commit per feature)
```

---

## Turn 2 — RSA key pair + JWKS endpoint

```
The database and seeding are working. Now generate the RSA key pair and expose the JWKS endpoint.

RSA key management:
- On startup, generate an RSA key pair (minimum 2048 bits) for signing tokens.
- Persist the key pair to disk (e.g. keys/private.pem and keys/public.pem)
  so the same keys are reused across server restarts.
- If the files already exist on disk, load them instead of generating new ones.
- Assign a stable kid (key ID) string to the key pair (e.g. derived from a hash of the public key
  or a fixed string stored alongside the key files).
- The RSA private key must NEVER appear in any HTTP response.

Implement:
  GET /.well-known/jwks.json
    200: {
      keys: [
        {
          kty: "RSA",
          use: "sig",
          alg: "RS256",
          kid: "<non-empty string>",
          n:   "<base64url-encoded RSA modulus>",
          e:   "<base64url-encoded RSA exponent>"
        }
      ]
    }
    At least one key must always be present.
```

---

## Turn 3 — Discovery endpoint

```
The JWKS endpoint is working. Now implement the OpenID Connect discovery endpoint.

Implement:
  GET /.well-known/openid-configuration
    200: {
      issuer:                                "<base_url>",
      authorization_endpoint:               "<base_url>/oauth2/authorize",
      token_endpoint:                        "<base_url>/oauth2/token",
      userinfo_endpoint:                     "<base_url>/userinfo",
      jwks_uri:                              "<base_url>/.well-known/jwks.json",
      response_types_supported:             ["code"],
      subject_types_supported:              ["public"],
      id_token_signing_alg_values_supported: ["RS256"]
    }

Rules:
- base_url must be derived from the server's actual host and port
  (e.g. http://localhost:3000 when running locally).
- authorization_endpoint must include "/oauth2/authorize".
- token_endpoint must include "/oauth2/token".
- userinfo_endpoint must include "/userinfo".
- jwks_uri must include "jwks".
- response_types_supported must include "code".
- id_token_signing_alg_values_supported must include "RS256".
- The kid in the JWKS response and the kid used in id_token headers must always match.

```

---

## Turn 4 — Authorization endpoint: GET (login form)

```
Discovery is working. Now implement the GET side of the authorization endpoint,
which validates OAuth params and returns an HTML login form.

GET /oauth2/authorize
  Accepts query params: client_id, redirect_uri, response_type, scope, state

  Validation — return 400 for any of the following:
    - client_id is missing or not found in the clients table
    - redirect_uri is missing or not listed in the client's registered redirect_uris
    - response_type is missing or is not exactly "code"
    - scope is missing or does not include "openid"

  On valid params, return 200 with an HTML page containing a <form> that:
    - Has method="POST" and action="/oauth2/authorize"
    - Includes hidden fields with name attributes:
        name="client_id"
        name="redirect_uri"
        name="state"
        name="response_type"
        name="scope"
    - Has a visible input for username (name="username")
    - Has a visible input for password (name="password", type="password")
    - Has a submit button

Both redirect URIs registered for "test-client" must be accepted:
  - http://localhost:8080/callback
  - http://localhost:3001/callback

```

---

## Turn 5 — Authorization endpoint: POST (credential validation + code issuance)

```
The login form renders correctly. Now implement the POST side of the authorization endpoint.

POST /oauth2/authorize
  Receives form body (application/x-www-form-urlencoded):
    client_id, redirect_uri, response_type, scope, state,
    username, password,
    and optionally: code_challenge, code_challenge_method

  On valid credentials:
    1. Look up the user by username in the users table; verify the password.
    2. Generate a cryptographically secure random authorization code.
    3. Store the code in the auth_codes table with:
         client_id, user_id, redirect_uri, scope,
         code_challenge, code_challenge_method,
         expires_at = now + 10 minutes (Unix timestamp),
         used = 0
    4. Redirect 302 to: redirect_uri?code=<code>&state=<echoed state>
       (if state was empty or absent, omit it from the redirect)

  On invalid credentials (wrong username or wrong password):
    - Return a non-302 response.
    - Re-render the login form with an error message that contains at least one of:
      "Invalid", "error", or "incorrect".
    - Preserve the original OAuth params in the form's hidden fields.

  PKCE:
    - Optional — the full flow must work both with and without PKCE.
    - When code_challenge and code_challenge_method="S256" are present in the body,
      store them in the auth_codes row alongside the code.
    - When absent, store NULL for both fields.

```

---

## Turn 6 — Token endpoint: client authentication + request validation

```
Authorization code issuance is working. Now implement the first half of the token endpoint:
client authentication and request parameter validation.

POST /oauth2/token
  Content-Type: application/x-www-form-urlencoded

  Client authentication — support both methods in the same endpoint:
    1. Body params:     client_id and client_secret present in the form body
    2. HTTP Basic auth: Authorization: Basic base64(client_id:client_secret)
       Parse the header, base64-decode it, and split on the first colon.

  Validation — return these exact error shapes:

    Status 400, { error: "invalid_request" } when:
      - grant_type is missing from the body
      - code is missing from the body
      - redirect_uri is missing from the body

    Status 400, { error: "unsupported_grant_type" } when:
      - grant_type is present but is not "authorization_code"

    Status 401, { error: "invalid_client" } when:
      - client_id cannot be determined (missing from both body and Basic header)
      - client_id is not found in the clients table
      - client_secret does not match the stored secret

  At the end of this turn, the endpoint must correctly reject all invalid requests
  with the right status codes and error strings.
  Do not issue tokens yet — that comes in Turn 7.

```

---

## Turn 7 — Token endpoint: code exchange + token issuance

```
Client authentication and request validation are working. Now complete the token endpoint
by exchanging the authorization code for tokens.

POST /oauth2/token (continued)

  After client authentication and request validation pass, validate the authorization code:

    Status 400, { error: "invalid_grant" } when:
      - The code is not found in the auth_codes table
      - The code has already been used (used = 1)
      - The code has expired (expires_at < now)
      - The redirect_uri in the request does not match the one stored with the code
      - The client_id in the request does not match the one stored with the code

  PKCE verification (only when code_challenge was stored with the code):
    Status 400, { error: "invalid_grant" } when:
      - code_verifier is absent from the request body
      - SHA-256(code_verifier), base64url-encoded without padding,
        does not equal the stored code_challenge

  On success:
    1. Mark the authorization code as used (used = 1) immediately — replay prevention.
    2. Generate a cryptographically secure random access_token string.
    3. Store the access_token in the tokens table with:
         client_id, user_id, scope, expires_at = now + 1 hour
    4. Build and sign an id_token JWT:
         Header:  { alg: "RS256", kid: "<same kid as in JWKS>" }
         Payload: {
           sub: "<user id as string>",
           iss: "<issuer URL>",
           aud: "<client_id>",
           exp: <Unix timestamp, now + 1 hour>,
           iat: <Unix timestamp, now>
         }
         Signature: RS256 with the server's RSA private key
    5. Return 200:
         {
           access_token: "<random string>",
           id_token:     "<signed JWT>",
           token_type:   "Bearer",
           expires_in:   3600
         }
       Response header must include: Cache-Control: no-store

```

---

## Turn 8 — UserInfo endpoint

```
Token issuance is working. Now implement the UserInfo endpoint.

GET /userinfo
  Requires: Authorization: Bearer <access_token>

  Return 401 when:
    - The Authorization header is absent
    - The Authorization header is present but the scheme is not "Bearer"
      (e.g. "Authorization: Basic <token>" must return 401)
    - The token is not found in the tokens table
    - The token has expired (expires_at < now)

  Return 200 when the token is valid:
    {
      sub:   "<user id as string — must match sub in the id_token>",
      email: "<user email address>"
    }
    email must be present whenever the scope stored with the token includes "email".

POST /userinfo:
  Return 200 or 405 (your choice — be consistent).

```

---

## Turn 9 — PKCE end-to-end + security hardening

```
All endpoints are implemented. Now harden security and verify PKCE works end-to-end.

PKCE audit:
1. Confirm the full PKCE S256 flow works without errors:
     a. GET /oauth2/authorize with code_challenge + code_challenge_method="S256" renders the form.
     b. POST /oauth2/authorize stores code_challenge and code_challenge_method in auth_codes.
     c. POST /oauth2/token with correct code_verifier succeeds and issues tokens.
     d. POST /oauth2/token with wrong code_verifier returns 400 invalid_grant.
     e. POST /oauth2/token without code_verifier (when challenge was stored) returns 400 invalid_grant.
2. Confirm the S256 algorithm is implemented correctly:
     SHA-256(code_verifier) → binary digest → base64url-encode → strip "=" padding
     → result must equal the stored code_challenge exactly.

Security hardening:
3. Confirm authorization codes are single-use:
     - After the first successful exchange, used = 1.
     - A second request with the same code returns 400 invalid_grant.
4. Confirm authorization codes expire within 10 minutes of issuance.
5. Confirm access tokens expire and are rejected at /userinfo after expiry.
6. Confirm the RSA private key never appears in any HTTP response body or header.
7. Confirm the id_token signature can be verified using the public key
   from GET /.well-known/jwks.json — the kid in the token header must match
   the kid in the JWKS response.
8. Confirm the token endpoint always responds with Cache-Control: no-store.
9. Confirm all JSON responses set Content-Type: application/json.

```

---

## Turn 10 — Final review + testability audit

```
Security hardening is complete. Do a full testability audit and deliver the final project.

Discovery and JWKS:
1. Confirm GET /.well-known/openid-configuration returns all required fields:
   issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri,
   response_types_supported (includes "code"),
   subject_types_supported (non-empty),
   id_token_signing_alg_values_supported (includes "RS256").
2. Confirm GET /.well-known/jwks.json returns at least one key with:
   kty="RSA", use="sig", alg="RS256", a non-empty kid, and non-empty n and e.

Authorization endpoint:
3. Confirm GET /oauth2/authorize returns 400 for missing/invalid client_id,
   unregistered redirect_uri, wrong response_type, or missing "openid" scope.
4. Confirm GET /oauth2/authorize returns 200 HTML with a <form> containing
   hidden fields named: client_id, redirect_uri, state, response_type, scope.
5. Confirm POST /oauth2/authorize redirects 302 with code and state on valid credentials.
6. Confirm POST /oauth2/authorize returns a non-302 response with an error message
   containing "Invalid", "error", or "incorrect" on wrong credentials.
7. Confirm both registered redirect URIs are accepted:
   http://localhost:8080/callback and http://localhost:3001/callback.

Token endpoint:
8. Confirm client authentication works via both body params and HTTP Basic auth.
9. Confirm exact error codes: invalid_request (400), unsupported_grant_type (400),
   invalid_client (401), invalid_grant (400).
10. Confirm successful response includes: access_token, id_token, token_type="Bearer", expires_in.
11. Confirm the id_token is a three-part JWT (header.payload.signature).
12. Confirm the id_token payload contains: sub, iss, aud (includes client_id), exp, iat.

UserInfo endpoint:
13. Confirm GET /userinfo returns 401 for absent header, non-Bearer scheme, and invalid token.
14. Confirm GET /userinfo returns 200 with sub and email for a valid Bearer token.
15. Confirm sub in the userinfo response matches sub in the id_token.

Database and seeding:
16. Confirm the server seeds test-client and testuser on startup without errors.
17. Confirm re-running the server with an existing database does not duplicate seed data.
18. Confirm all four tables exist with the correct column names.

```