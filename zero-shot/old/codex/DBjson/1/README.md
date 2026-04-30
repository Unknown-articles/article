# DBjson API

Dynamic REST API built with Node.js and Express, using a single JSON file as the database.

## Features

- Dynamic collections on any route such as `/users`, `/products`, `/orders`
- CRUD for all dynamic resources
- Single-file JSON persistence with atomic writes
- JWT authentication with register and login
- RBAC with `admin` and `user`
- Resource ownership and owner/admin protection
- Resource sharing with users and teams
- In-memory write queue to avoid concurrent write races
- Advanced querying with filters, logical groups, sorting, and pagination

## Project Structure

```text
DBjson/
├── data/
│   └── db.json
├── src/
│   ├── db/
│   │   └── fileStore.js
│   ├── middleware/
│   │   └── auth.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── dataService.js
│   │   └── queryService.js
│   ├── app.js
│   ├── config.js
│   ├── errors.js
│   └── server.js
├── test/
│   └── api.test.js
├── .gitignore
├── package-lock.json
├── package.json
└── README.md
```

## Getting Started

```bash
npm install
npm start
```

Optional environment variables:

- `PORT`: server port, default `3000`
- `JWT_SECRET`: JWT signing secret
- `DATA_FILE`: custom database file path

## Authentication

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "username": "alice",
  "password": "secret",
  "role": "admin"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "secret"
}
```

Use the returned JWT in `Authorization: Bearer <token>`.

## Dynamic Resources

### Create

```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Keyboard",
  "price": 120
}
```

### List

```http
GET /products
Authorization: Bearer <token>
```

### Share a Resource

```http
POST /products/{id}/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "users": [
    { "userId": "user-id", "access": "write" }
  ],
  "teams": [
    { "teamId": "team-id", "access": "read" }
  ]
}
```

## Teams

- `GET /auth/teams`
- `POST /auth/teams`
- `POST /auth/teams/:teamId/members`

## Querying

List endpoints support:

- `filter`: JSON expression with `and` / `or`
- `sort`: comma-separated `field:asc|desc`
- `limit`
- `offset`

Example:

```http
GET /products?filter={"and":[{"field":"price","op":">=","value":50},{"field":"name","op":"contains","value":"key"}]}&sort=price:desc&limit=10&offset=0
Authorization: Bearer <token>
```

Supported operators:

- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`
- `between`
- `contains`
- `like`

Fields can target top-level metadata such as `ownerId` or payload fields such as `price` and `details.category`.

## Tests

```bash
npm test
```
