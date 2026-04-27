# Dynamic JSON REST API

Node.js + Express REST API using file-based JSON persistence.

## Features

- Dynamic resource CRUD for any route
- JWT authentication and role-based access control
- User and team sharing with read/write permissions
- Query filtering, sorting, pagination
- Safe JSON file persistence with an in-memory write queue

## Run

- Install: `npm install`
- Start: `npm start`
- Default port: `3000`
- DB file path: set `DB_PATH` environment variable
- JWT secret: set `JWT_SECRET`

## API

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/users`
- `PATCH /auth/users/:id/role`
- `POST /auth/teams`
- `POST /auth/teams/:id/members`
- `DELETE /auth/teams/:id/members/:userId`
- `GET /auth/teams`
- `GET /auth/teams/:id`
- `PATCH /auth/teams/:id`
- `DELETE /auth/teams/:id`
- `POST /:resource`
- `GET /:resource`
- `GET /:resource/:id`
- `PUT /:resource/:id`
- `PATCH /:resource/:id`
- `DELETE /:resource/:id`
