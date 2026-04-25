# Dynamic REST API

A generic and dynamic REST API built with Node.js and Express, using a JSON file as the database.

## Features

- Dynamic resource creation and management
- CRUD operations for any resource
- Token-based authentication (JWT)
- Role-based access control (admin, user)
- Data ownership and sharing
- Advanced querying with filters, sorting, pagination
- Concurrency control with file locking

## Installation

1. Clone or download the project.
2. Run `npm install` to install dependencies.

## Usage

1. Start the server: `npm start`
2. For development: `npm run dev`

### Authentication

- Register: `POST /auth/register` with `{ "username": "user", "password": "pass", "role": "user" }`
- Login: `POST /auth/login` with `{ "username": "user", "password": "pass" }` returns JWT token

Use the token in `Authorization: Bearer <token>` header for protected routes.

### API Endpoints

All routes are dynamic. Replace `:resource` with any name (e.g., users, products).

- `GET /:resource` - List items (with query params for filtering/sorting/pagination)
- `GET /:resource/:id` - Get single item
- `POST /:resource` - Create new item
- `PUT /:resource/:id` - Replace item
- `PATCH /:resource/:id` - Update item
- `DELETE /:resource/:id` - Delete item

### Query Parameters

- Filtering: `?field=value`, `?field__op=value` (ops: eq, ne, gt, lt, gte, lte, contains, between)
- Sorting: `?sort=field:asc` or `?sort=field:desc`
- Pagination: `?limit=10&offset=0`

### Data Ownership

Each item has an `ownerId`. Only owners or admins can modify/delete.

### Sharing

Items can have `sharedWith` array of user IDs for shared access.

## Troubleshooting

- Ensure `db.json` is writable.
- Set `JWT_SECRET` environment variable for production.
- Check console for errors on startup.