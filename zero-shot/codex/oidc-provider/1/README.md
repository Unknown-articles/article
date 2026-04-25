# OIDC Provider

Minimal OpenID Connect Provider built with Express, SQLite3, and ES modules.

## Requirements

- Node.js 20+
- npm

## Run

```bash
npm install
npm start
```

The server listens on `http://localhost:3000` by default. Set `PORT` to override it.

## Test

```bash
npm test
```

## Seeded data

Client:

- `client_id`: `test-client`
- `client_secret`: `test-secret`
- `redirect_uris`:
  - `http://localhost:8080/callback`
  - `http://localhost:3001/callback`

User:

- `username`: `testuser`
- `password`: `password123`
- `email`: `testuser@example.com`

## Project structure

```text
.
|-- README.md
|-- package.json
|-- src
|   |-- app.js
|   |-- config
|   |   `-- index.js
|   |-- constants
|   |   |-- clients.js
|   |   `-- users.js
|   |-- controllers
|   |   |-- authorization-controller.js
|   |   |-- discovery-controller.js
|   |   |-- jwks-controller.js
|   |   |-- token-controller.js
|   |   `-- userinfo-controller.js
|   |-- db
|   |   |-- init.js
|   |   |-- schema.js
|   |   |-- seed.js
|   |   `-- sqlite.js
|   |-- middleware
|   |   |-- bearer-auth.js
|   |   `-- error-handler.js
|   |-- routes
|   |   |-- authorization-routes.js
|   |   |-- discovery-routes.js
|   |   |-- jwks-routes.js
|   |   |-- token-routes.js
|   |   `-- userinfo-routes.js
|   |-- services
|   |   |-- access-token-service.js
|   |   |-- authorization-service.js
|   |   |-- client-service.js
|   |   |-- key-service.js
|   |   |-- token-service.js
|   |   `-- user-service.js
|   `-- utils
|       |-- encoding.js
|       |-- html.js
|       `-- http.js
`-- test
    |-- authorization.test.js
    |-- discovery.test.js
    |-- jwks.test.js
    `-- token.test.js
```

## Database schema

SQLite tables created on startup:

- `users`
- `clients`
- `client_redirect_uris`
- `authorization_codes`
- `tokens`
- `signing_keys`
