# OpenID Connect Provider

A minimal OpenID Connect provider built with Node.js, Express, and SQLite.

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```

The server listens on port `4000` by default. Use `PORT` to override.

## Endpoints

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/authorize`
- `POST /oauth2/token`
- `GET /userinfo`

## Seeded test data

- Client: `test-client` / `test-secret`
- Redirect URIs: `http://localhost:8080/callback`, `http://localhost:3001/callback`
- User: `testuser` / `password123`
- Email: `testuser@example.com`
