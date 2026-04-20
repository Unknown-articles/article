# OIDC Provider

A simple OpenID Connect Provider implementation using Node.js, Express, and SQLite.

## Setup

1. Install dependencies: `npm install`
2. Run the server: `npm start`
3. Server listens on port 3000 (or PORT env var)

## Endpoints

- Discovery: GET /.well-known/openid-configuration
- JWKS: GET /.well-known/jwks.json
- Authorize: GET /oauth2/authorize
- Token: POST /oauth2/token
- UserInfo: GET /userinfo

## Test Data

Pre-seeded with test client and user.