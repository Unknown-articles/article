# OIDC Provider

A simple OpenID Connect Provider REST API built with Node.js, Express, and SQLite.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Generate RSA keys:
   ```
   npm run generate-keys
   ```

3. Initialize the database:
   ```
   npm run init-db
   ```

4. Start the server:
   ```
   npm start
   ```

The server will run on http://localhost:3000.

## Endpoints

- Discovery: GET /.well-known/openid-configuration
- JWKS: GET /.well-known/jwks.json
- Authorization: GET /oauth2/authorize
- Token: POST /oauth2/token
- UserInfo: GET /userinfo

## Default Client

- client_id: client1
- client_secret: secret
- redirect_uri: http://localhost:3001/callback

## Default User

- username: user1
- email: user@example.com
- name: User