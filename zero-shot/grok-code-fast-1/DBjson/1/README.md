# Dynamic REST API

A Node.js Express API with file-based JSON database, JWT authentication, RBAC, and dynamic resource handling.

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

Or for development:

```bash
npm run dev
```

## Endpoints

### Health
- `GET /health` - Returns status ok

### Authentication
- `POST /auth/register` - Register a new user (first user is admin)
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile
- `GET /auth/users` - List all users (admin only)
- `PATCH /auth/users/:id/role` - Change user role (admin only)

### Teams
- `POST /auth/teams` - Create a team
- `GET /auth/teams` - List user's teams
- `GET /auth/teams/:id` - Get team details
- `PATCH /auth/teams/:id` - Update team name (owner only)
- `DELETE /auth/teams/:id` - Delete team (owner only)
- `POST /auth/teams/:id/members` - Add member to team (admin only)
- `DELETE /auth/teams/:id/members/:userId` - Remove member from team

### Dynamic Resources
For any resource (e.g., /users, /products), supports:
- `GET /:resource` - List items (with filtering, sorting, pagination)
- `GET /:resource/:id` - Get single item
- `POST /:resource` - Create new item
- `PUT /:resource/:id` - Replace item
- `PATCH /:resource/:id` - Update item
- `DELETE /:resource/:id` - Delete item

## Features

- **Dynamic Collections**: Any route creates collections on the fly
- **Authentication**: JWT-based
- **Authorization**: RBAC (admin, user)
- **Data Ownership**: Each item has ownerId
- **Sharing**: Share items with users or teams, with read/write permissions
- **Querying**: Equality, inequality, ranges, contains, in, between, AND/OR logic, sorting, pagination
- **Concurrency**: Safe file writes using fs-extra

## Database

Data is stored in `db.json` as a JSON object with collections as keys.

Reserved collections: `_users`, `auth`, `teams`

## Testing

The API is designed to pass the specified test cases.