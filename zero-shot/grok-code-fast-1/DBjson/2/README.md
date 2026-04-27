# Dynamic REST API

A generic REST API built with Node.js and Express, using a file-based JSON database. Supports dynamic resource creation, authentication, role-based access control, data ownership, sharing, and advanced querying.

## Features

- **Dynamic Resources**: Create any resource collection on-the-fly via POST requests.
- **CRUD Operations**: Full Create, Read, Update, Delete for all resources.
- **Authentication**: JWT-based login/register.
- **Role-Based Access Control**: Admin and user roles.
- **Data Ownership**: Resources owned by users, with sharing capabilities.
- **Team Sharing**: Share resources with teams.
- **Advanced Querying**: Filtering, sorting, pagination with various operators.
- **Concurrency Control**: File locking to prevent race conditions.

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

The server starts on port 3000 by default. Use `PORT` environment variable to change it.

The database file is `db.json` by default. Use `DB_PATH` to specify a different path.

On startup, the server prints "running on port XXXX".

## API Endpoints

### Health
- `GET /health` - Returns `{ status: "ok" }`

### Authentication
- `POST /auth/register` - Register a new user. Body: `{ username, password }`
- `POST /auth/login` - Login. Body: `{ username, password }`. Returns `{ token }`
- `GET /auth/me` - Get current user info (requires auth)
- `GET /auth/users` - List all users (admin only)
- `PATCH /auth/users/:id/role` - Update user role (admin only). Body: `{ role: "admin"|"user" }`

### Teams
- `POST /auth/teams` - Create a team. Body: `{ name }`
- `GET /auth/teams` - List user's teams
- `GET /auth/teams/:id` - Get team details
- `POST /auth/teams/:id/members` - Add member to team (owner or admin)
- `DELETE /auth/teams/:id/members/:userId` - Remove member (owner only)
- `PATCH /auth/teams/:id` - Update team name (owner)
- `DELETE /auth/teams/:id` - Delete team (owner)

### Dynamic Resources
- `POST /:resource` - Create a new item in the resource collection
- `GET /:resource` - List items (with optional query params)
- `GET /:resource/:id` - Get a specific item
- `PUT /:resource/:id` - Replace an item
- `PATCH /:resource/:id` - Update an item
- `DELETE /:resource/:id` - Delete an item

Resources starting with `_` or `auth` are reserved.

## Query Parameters for GET /:resource

- Filtering: `field=value`, `field__ne=value`, `field__gt=value`, etc.
- Logic: `_or=true` for OR instead of AND
- Sorting: `_sort=field`, `_order=asc|desc`
- Pagination: `_limit=N`, `_offset=N`

## Sharing

Items can have `sharedWith: [{ userId, access: "read"|"write" }]`

And `sharedWithTeams: [{ teamId, access: "read"|"write" }]`

## Dependencies

- express
- jsonwebtoken
- bcryptjs
- uuid
- fs-extra
- proper-lockfile