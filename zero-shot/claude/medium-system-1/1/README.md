# Unified Backend Platform

A single Node.js service combining:

- **Dynamic JSON Database** — arbitrary collections stored in `data.json`
- **Built-in OIDC Provider** — full Authorization Code + PKCE flow backed by SQLite
- **Real-time Resource Monitor** — WebSocket broadcast of CPU / memory / uptime

## Requirements

- Node.js 18 or later
- npm 9 or later

## Installation

```bash
npm install
```

## Start

```bash
npm start
```

On first run the server seeds two users and one OIDC client into SQLite.

---

## Default credentials

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | `admin@example.com` | `admin123` | admin |
| User  | `user@example.com`  | `user123`  | user  |

**OIDC client**

| Field | Value |
|-------|-------|
| `client_id` | `demo-client` |
| `redirect_uri` | `http://localhost:3000/callback` |

---

## OIDC flow (Authorization Code + PKCE)

```
1.  GET  /oauth2/authorize?client_id=demo-client
         &redirect_uri=http://localhost:3000/callback
         &response_type=code
         &scope=openid
         &code_challenge=<BASE64URL(SHA256(verifier))>
         &code_challenge_method=S256
         &state=xyz

    → HTML login form

2.  POST /oauth2/authorize  (form body: email, password)
    → 302 to redirect_uri?code=...&state=xyz

3.  POST /oauth2/token
    Content-Type: application/x-www-form-urlencoded

    grant_type=authorization_code
    &code=<code>
    &client_id=demo-client
    &code_verifier=<verifier>

    → { access_token, id_token, token_type, expires_in }
```

---

## JSON DB API  `/api/:collection`

All endpoints require `Authorization: Bearer <access_token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/:collection` | List resources (supports filter/sort/page) |
| GET    | `/api/:collection/:id` | Get one resource |
| POST   | `/api/:collection` | Create resource (auto-creates collection) |
| PUT    | `/api/:collection/:id` | Full replace |
| PATCH  | `/api/:collection/:id` | Partial update |
| DELETE | `/api/:collection/:id` | Delete |

### Query parameters

```
filter[field][op]=value   ops: eq ne gt lt gte lte between like
logic=or                  default is AND
sort=field:asc|desc
limit=20&offset=0
```

### Ownership

Every resource carries `ownerId` (set to the authenticated user) and
`sharedWith` (array of `{ userId, canWrite }` objects).  Admins bypass
all restrictions.

---

## Metrics REST  `/metrics`

Requires Bearer token.

| Endpoint | Returns |
|----------|---------|
| `GET /metrics` | `{ cpu, memory: { total, used, free, usedPercent }, uptime }` |
| `GET /metrics/cpu` | `{ cpu: 40.2 }` |
| `GET /metrics/memory` | `{ memory: { … } }` |
| `GET /metrics/uptime` | `{ uptime: 42.3 }` |

---

## WebSocket  `ws://localhost:3000/ws`

```jsonc
// 1. Authenticate immediately after connecting
{ "type": "auth", "token": "<access_token>" }
// ← { "type": "auth", "status": "ok", "userId": "..." }

// 2. Subscribe to metrics
{ "action": "subscribe", "metrics": ["cpu", "memory"] }
// ← { "type": "subscribed", "metrics": ["cpu", "memory"] }

// 3. Receive updates every second
// ← { "type": "update", "data": { "cpu": 12.5, "memory": { … } } }

// 4. Unsubscribe
{ "action": "unsubscribe", "metrics": ["cpu"] }
```

Unauthenticated connections are closed after 30 seconds.

---

## Error format

All errors (HTTP and WebSocket) use the same envelope:

```json
{ "error": "error_code", "message": "Human-readable description" }
```

---

## Project structure

```
src/
  config.js                  Global constants (PORT, paths, TTLs)
  index.js                   Entry point — wires everything together
  db/
    sqlite.js                Schema creation + seed data
  services/
    jsonDb.js                File-based DB with write-queue concurrency
    metricsService.js        CPU/memory/uptime collector
    oidcService.js           RSA keys, PKCE, auth codes, JWT signing
  middleware/
    auth.js                  Bearer token guard
    errorHandler.js          Consistent error shape
  routes/
    dbJson.js                Dynamic CRUD API
    metrics.js               REST metrics
    oidc.js                  OIDC endpoints
  websocket/
    wsServer.js              WS server — auth + subscriptions + broadcast
data.json                    Runtime JSON store (created automatically)
database.sqlite              SQLite identity store (git-ignored)
```
