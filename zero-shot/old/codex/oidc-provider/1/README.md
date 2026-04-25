# OIDC Provider REST API

Minimal OpenID Connect provider built with Node.js, Express, ES Modules, SQLite3, and Git.

## Requirements

- Node.js 24+
- npm 11+

## Install and run

```bash
npm install
npm test
npm start
```

Default issuer: `http://127.0.0.1:3000`

## Seeded data

- User: `alice@example.com` / `password123`
- Client ID: `oidc-client`
- Client Secret: `super-secret-client`
- Redirect URI: `http://127.0.0.1:4000/callback`

## Endpoints

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/token`
- `GET /userinfo`
- `POST /oauth2/keys/rotate`

## Authorization example

```bash
curl "http://127.0.0.1:3000/oauth2/authorize?response_type=code&client_id=oidc-client&redirect_uri=http://127.0.0.1:4000/callback&scope=openid%20profile%20email&state=xyz&login_hint=alice@example.com&password=password123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
```

## Token example

```bash
curl -X POST http://127.0.0.1:3000/oauth2/token ^
  -H "Content-Type: application/json" ^
  -d "{\"grant_type\":\"authorization_code\",\"code\":\"AUTH_CODE\",\"client_id\":\"oidc-client\",\"redirect_uri\":\"http://127.0.0.1:4000/callback\",\"code_verifier\":\"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\"}"
```

## Database schema

The SQLite schema is initialized automatically on startup from [src/database/schema.js](/c:/Users/diegt/Documents/architecture-projects/zero-shot/codex/oidcprovider/src/database/schema.js).

Tables:

- `users`: subject, email, name, password
- `clients`: client_id, client_secret, redirect URIs, grants, response types, scopes
- `authorization_codes`: issued authorization codes, PKCE data, expiry, consumption state
- `tokens`: signed access tokens and ID tokens issued to users and clients
- `signing_keys`: RSA JWK pairs used for signing and JWKS publication

## Project structure

```text
.
|-- README.md
|-- package.json
|-- src
|   |-- app.js
|   |-- bootstrap.js
|   |-- server.js
|   |-- config
|   |   `-- env.js
|   |-- controllers
|   |   |-- authorization-controller.js
|   |   |-- discovery-controller.js
|   |   |-- jwks-controller.js
|   |   |-- token-controller.js
|   |   `-- userinfo-controller.js
|   |-- database
|   |   |-- db.js
|   |   |-- schema.js
|   |   `-- seed.js
|   |-- middleware
|   |   |-- authenticate-bearer.js
|   |   `-- error-handler.js
|   |-- routes
|   |   |-- admin-routes.js
|   |   |-- oauth-routes.js
|   |   |-- userinfo-routes.js
|   |   `-- well-known-routes.js
|   |-- services
|   |   |-- authorization-service.js
|   |   |-- client-service.js
|   |   |-- key-service.js
|   |   |-- metadata-service.js
|   |   |-- token-service.js
|   |   `-- user-service.js
|   `-- utils
|       |-- errors.js
|       |-- random.js
|       `-- time.js
`-- test
    |-- authorization.test.js
    |-- discovery.test.js
    |-- jwks.test.js
    |-- token.test.js
    |-- test-helpers.js
    `-- userinfo.test.js
```
