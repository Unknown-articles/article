Create an OpenID Connect (OIDC) Provider REST API using:

- JavaScript (ES Modules, not CommonJS)
- Node.js with Express
- SQLite3 as the database
- Git for source control

GENERAL REQUIREMENTS

- Follow OAuth 2.0 and OpenID Connect Core specifications.
- Use a modular architecture (routes, controllers, services, middleware).
- All endpoints must return valid JSON responses.
- Ensure the system is runnable and testable.

FEATURES

1. Discovery Endpoint

- Implement: GET /.well-known/openid-configuration
- Return all required OIDC metadata, including:

- issuer

- authorization_endpoint

- token_endpoint

- userinfo_endpoint

- jwks_uri

- response_types_supported

- subject_types_supported

- id_token_signing_alg_values_supported

2. JWKS Endpoint

- Implement: GET /.well-known/jwks.json
- Generate and expose a JSON Web Key Set (JWKS)
- Use RSA keys for signing tokens
- Include key rotation capability (basic support)

3. Authorization Endpoint

- Implement: GET /oauth2/authorize
- Support:

- response_type=code (Authorization Code Flow)

- client_id validation

- redirect_uri validation

- scope handling (openid required)

- state parameter

- Simulate user authentication (basic login or mock user)
- Generate and return authorization code

4. Token Endpoint

- Implement: POST /oauth2/token
- Support:

- grant_type=authorization_code

- PKCE (code_verifier, code_challenge)

- Validate:

- authorization code

- redirect_uri

- client_id

- Return:

- access_token

- id_token (JWT)

- token_type

- expires_in

5. UserInfo Endpoint

- Implement: GET /userinfo
- Require Bearer access token
- Validate token
- Return user claims (sub, email, name, etc.)

DATABASE (SQLite)

- Store:

- users

- clients

- authorization codes

- tokens

- Define proper schema and relationships

SECURITY

- Sign ID tokens using RSA private key
- Validate JWTs using JWKS
- Use secure random values for tokens and codes
- Implement basic input validation and error handling

DEVELOPMENT PROCESS

- Implement each feature incrementally
- Each feature must correspond to a separate Git commit
- Each commit must result in a fully working system

OUTPUT

- Provide full project structure
- Include all source files
- Include database schema and initialization

TESTABILITY

Server

- Server must listen on port 3000 (configurable via PORT env var)
- All JSON responses must set Content-Type: application/json

Pre-Seeded Test Data

The database must be seeded on startup with the following data so that tests can run without manual setup:

  Client:
    client_id:     "test-client"
    client_secret: "test-secret"
    redirect_uris: ["http://localhost:8080/callback", "http://localhost:3001/callback"]

  User:
    username: "testuser"
    password: "password123"
    email:    any valid email string (e.g. "testuser@example.com")

Discovery Endpoint — GET /.well-known/openid-configuration

  200: {
    issuer:                                string (HTTP or HTTPS URL),
    authorization_endpoint:                string (must include "/oauth2/authorize"),
    token_endpoint:                        string (must include "/oauth2/token"),
    userinfo_endpoint:                     string (must include "/userinfo"),
    jwks_uri:                              string (must include "jwks"),
    response_types_supported:             string[] (must include "code"),
    subject_types_supported:              string[] (non-empty),
    id_token_signing_alg_values_supported: string[] (must include "RS256")
  }

JWKS Endpoint — GET /.well-known/jwks.json

  200: {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        alg: "RS256",
        kid: string (non-empty),
        n:   string (RSA modulus, base64url),
        e:   string (RSA exponent, base64url)
      }
    ]
  }
  At least one key must be present.

Authorization Endpoint — GET /oauth2/authorize

  Valid params: client_id, redirect_uri, response_type="code", scope (must include "openid"), state (optional)

  200: HTML page containing a <form> with hidden fields:
         name="client_id", name="redirect_uri", name="state"
       (the form must POST the user credentials together with the OAuth params)

  400: when any of these are invalid or missing:
    - client_id missing or unknown
    - redirect_uri missing or not registered for the client
    - response_type missing or not "code"
    - scope missing or does not include "openid"

Authorization Endpoint — POST /oauth2/authorize

  The endpoint receives: client_id, redirect_uri, response_type, scope, state,
                         username, password, and optionally code_challenge + code_challenge_method.

  On valid credentials:
    302 redirect to redirect_uri with query params: code=<authcode>&state=<echoed-state>

  On wrong credentials:
    Non-302 response (re-render the form with an error message containing "Invalid", "error", or "incorrect")

  PKCE:
    - Optional — the flow must also work without PKCE
    - When code_challenge + code_challenge_method="S256" are present, they must be stored with the code
      and verified at the token endpoint

  Both redirect URIs registered for "test-client" must be accepted:
    - http://localhost:8080/callback
    - http://localhost:3001/callback

Token Endpoint — POST /oauth2/token

  Content-Type: application/x-www-form-urlencoded

  Client authentication — two methods must be supported:
    1. Body params:      client_id + client_secret in the form body
    2. HTTP Basic auth:  Authorization: Basic base64(client_id:client_secret)

  Error responses (exact error codes required):

    Status 400, body.error = "invalid_request"   when:
      - grant_type is missing
      - code is missing
      - redirect_uri is missing

    Status 400, body.error = "unsupported_grant_type"  when:
      - grant_type is anything other than "authorization_code"

    Status 401, body.error = "invalid_client"   when:
      - client_id is missing
      - client_id is unknown
      - client_secret is wrong

    Status 400, body.error = "invalid_grant"    when:
      - authorization code is invalid/unknown
      - authorization code has already been used (replay prevention — each code must be single-use)
      - redirect_uri does not match the one used during authorization
      - PKCE code_verifier does not match the stored code_challenge (S256)

  Successful response (200):
    {
      access_token: string,
      id_token:     string (3-part JWT),
      token_type:   "Bearer",
      expires_in:   number
    }
    Response header must include: Cache-Control: no-store

  id_token JWT structure:
    Header:  { alg: "RS256", kid: string }
    Payload: { sub: string, iss: string, aud: string|string[] (must include client_id),
               exp: number (Unix timestamp in the future), iat: number }
    Signature: RS256 signed with the server's RSA private key;
               must verify against the public key exposed at /.well-known/jwks.json

UserInfo Endpoint — GET /userinfo

  Requires: Authorization: Bearer <access_token>

  401: when Authorization header is absent
  401: when token is invalid or not a Bearer token
  401: when scheme is not "Bearer" (e.g. Basic <token> must return 401)

  200: {
    sub:   string (non-empty, same identifier as in the id_token),
    email: string (present when scope included "email")
  }

  POST /userinfo: must return 200 or 405 (implementation-defined)

PKCE Algorithm (S256)

  code_verifier  → SHA-256 hash → base64url-encode (no padding) → code_challenge
  code_challenge_method must be "S256"
  At the token endpoint, recompute SHA-256(code_verifier) and compare with stored code_challenge.