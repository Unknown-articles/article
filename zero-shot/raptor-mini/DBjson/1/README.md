# Dynamic JSON REST API

A Node.js + Express REST API with generic dynamic resources, file-based persistence, JWT auth, RBAC, ownership, sharing, team support, and advanced query filtering.

## Structure

- `server.js` - entry point
- `src/app.js` - Express application
- `src/dataStore.js` - JSON file persistence with queue locking
- `src/routes/authRoutes.js` - authentication, users, and teams
- `src/routes/dynamicRoutes.js` - generic resource CRUD
- `src/middleware/authMiddleware.js` - JWT validation and role guard
- `src/utils/query.js` - filter, sort, and pagination
- `src/utils/access.js` - ownership and sharing rules
- `data/db.json` - persisted storage
- `tests/api.test.js` - end-to-end API tests

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## Test

```bash
npm test
```
