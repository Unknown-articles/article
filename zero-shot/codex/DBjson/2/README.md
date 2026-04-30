# Dynamic JSON REST API

Generic Express API backed by one JSON file. It supports JWT authentication,
admin/user roles, owner-based access, per-user and team sharing, dynamic CRUD
collections, filtering, sorting, pagination, and serialized JSON-file writes.

## Project Structure

```text
.
├── README.md
├── package.json
├── package-lock.json
├── src
│   ├── auth.js
│   ├── db.js
│   ├── index.js
│   ├── resources.js
│   └── utils.js
└── test
    └── integration.test.js
```

## Run

```bash
npm install
npm start
```

Configuration:

- `PORT`: server port, default `3000`
- `DB_PATH`: JSON database file path, default `./db.json`
- `JWT_SECRET`: signing secret, default development-only value

The server entry point is `src/index.js`. On startup it prints a line containing
`running on`, which is used by the test harness.

## Endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/users`
- `PATCH /auth/users/:id/role`
- `POST /auth/teams`
- `GET /auth/teams`
- `GET /auth/teams/:id`
- `PATCH /auth/teams/:id`
- `DELETE /auth/teams/:id`
- `POST /auth/teams/:id/members`
- `DELETE /auth/teams/:id/members/:userId`
- `POST /:resource`
- `GET /:resource`
- `GET /:resource/:id`
- `PUT /:resource/:id`
- `PATCH /:resource/:id`
- `DELETE /:resource/:id`

Dynamic routes reject reserved collections `_users` and `_teams`.

## Querying

Supported query controls on `GET /:resource`:

- Filters: `field=value`, `field__ne`, `field__gt`, `field__gte`,
  `field__lt`, `field__lte`, `field__between`, `field__contains`,
  `field__like`, `field__startswith`, `field__endswith`, `field__in`
- Logic: `_or=true`
- Sorting: `_sort=field&_order=asc|desc`
- Pagination: `_limit=N&_offset=N`

Ownership and sharing rules are applied before filtering, sorting, and
pagination.

## Test

```bash
npm test
```
