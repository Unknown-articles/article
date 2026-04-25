# OIDC Provider

A minimal OpenID Connect Provider built with Node.js, Express, and SQLite3.

## Run

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm start
```

3. Open browser

- Discovery: `http://localhost:3000/.well-known/openid-configuration`
- JWKS: `http://localhost:3000/.well-known/jwks.json`

## Seeded Data

- Client ID: `test-client`
- Client Secret: `test-secret`
- Redirect URIs:
  - `http://localhost:8080/callback`
  - `http://localhost:3001/callback`
- User:
  - username: `testuser`
  - password: `password123`
  - email: `testuser@example.com`
