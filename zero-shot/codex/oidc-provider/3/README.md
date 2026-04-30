# OIDC Provider REST API

A small OpenID Connect Provider implemented with Node.js, Express, ES modules, and SQLite3.

## Run

```bash
npm install
npm start
```

The server listens on `http://localhost:4000` by default. Set `PORT` to override it.

## Seeded Test Data

Client:

- `client_id`: `test-client`
- `client_secret`: `test-secret`
- `redirect_uris`: `http://localhost:8080/callback`, `http://localhost:3001/callback`

User:

- `username`: `testuser`
- `password`: `password123`
- `email`: `testuser@example.com`

## Endpoints

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/authorize`
- `POST /oauth2/token`
- `GET /userinfo`
