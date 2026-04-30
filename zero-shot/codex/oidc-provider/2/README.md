# OIDC Provider REST API

Minimal OpenID Connect Provider implemented with JavaScript ES modules, Node.js, Express, and SQLite.

## Run

```bash
npm install
npm start
```

The server listens on `PORT` or `4000`.

## Test

```bash
npm test
```

The runtime initializer in `src/db.js` creates the SQLite database and seed data automatically. The schema is also available in `db/schema.sql`.

## Seed Data

Startup initializes the SQLite schema and seeds:

- Client `test-client` / `test-secret`
- Redirect URIs `http://localhost:8080/callback` and `http://localhost:3001/callback`
- User `testuser` / `password123`

## Endpoints

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/authorize`
- `POST /oauth2/token`
- `GET /userinfo`
