# OIDC Provider

Minimal OpenID Connect provider built with Node.js, Express, and SQLite.

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start server:
   ```bash
   npm start
   ```
3. Server listens on `http://localhost:4000` by default.

## Seeded test data

- Client:
  - `client_id`: `test-client`
  - `client_secret`: `test-secret`
  - redirect URIs: `http://localhost:8080/callback`, `http://localhost:3001/callback`
- User:
  - `username`: `testuser`
  - `password`: `password123`
  - `email`: `testuser@example.com`
