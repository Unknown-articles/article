# Dynamic REST API

A Node.js Express API with file-based JSON database, supporting dynamic resources, authentication, RBAC, sharing, and advanced querying.

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

## Environment Variables

- `PORT`: Server port (default 3000)
- `DB_PATH`: Path to JSON database file (default ./db.json)
- `JWT_SECRET`: Secret for JWT tokens (default 'secret')

## API Endpoints

### Health

- `GET /health`: Returns { status: "ok" }

### Authentication

- `POST /auth/register`: Register user { username, password }
- `POST /auth/login`: Login { username, password } -> { token }
- `GET /auth/me`: Get current user profile
- `GET /auth/users`: Admin only, list all users
- `PATCH /auth/users/:id/role`: Admin only, update user role

### Teams

- `POST /auth/teams`: Create team { name }
- `GET /auth/teams`: List user's teams
- `GET /auth/teams/:id`: Get team details
- `PATCH /auth/teams/:id`: Update team (owner only)
- `DELETE /auth/teams/:id`: Delete team (owner only)
- `POST /auth/teams/:id/members`: Add member (admin or owner)
- `DELETE /auth/teams/:id/members/:userId`: Remove member (owner only)

### Dynamic Resources

- `POST /:resource`: Create item
- `GET /:resource`: List items with optional querying
- `GET /:resource/:id`: Get single item
- `PUT /:resource/:id`: Replace item
- `PATCH /:resource/:id`: Update item
- `DELETE /:resource/:id`: Delete item

## Features

- Dynamic resource creation
- JWT authentication
- Role-based access control (admin, user)
- Data ownership and sharing
- Advanced querying with filters, sorting, pagination
- Concurrency-safe file operations