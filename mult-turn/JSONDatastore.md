## Turn 1 — Project setup + health endpoint

```
Create a Node.js server using Express that:

1. Default port is 3000 (configurable via PORT env var).
2. Prints a line to stdout containing the word "running on" when ready.
3. Reads the database file path from DB_PATH env var.
4. Loads the JSON file on startup; if the file does not exist or is empty,
   initializes it with: { "_users": [], "_teams": [] }
6. Handles the initial DB file shape { "_users": [], "_teams": [] } without errors.
7. Exposes GET /health returning 200: { status: "ok" }.

Implementation requirements:
- No routes other than /health yet.
- The server must start and respond to GET /health at the end of this step.
- Use Git for source control (one commit per feature)
```

---

## Turn 2 — Dynamic CRUD routes

```
The server boots correctly. Now add dynamic resource routing:

1. Expose dynamic routes for any resource name (e.g. /users, /products).
2. Implement all five operations:
   - GET    /:resource        → return all items in the collection (empty array if none)
   - GET    /:resource/:id    → return a single item by id; 404 if not found
   - POST   /:resource        → create a new item; auto-generate a unique id
   - PUT    /:resource/:id    → fully replace an item; 404 if not found
   - PATCH  /:resource/:id    → partially update an item; 404 if not found
   - DELETE /:resource/:id    → remove an item; 200 or 204 on success; 404 if not found
3. Store data under a key matching the route name in the JSON file.
4. Ensure safe read/write operations on the JSON file (no corruption on sequential requests).
5. A POST to a non-existent collection must create that collection automatically.

All routes are open (no authentication yet).
```

---

## Turn 3 — JWT authentication (register + login)

```
Dynamic CRUD is working. Now add user registration and login:

1. POST /auth/register   body: { username, password }
   - Returns 400 if username or password is missing.
   - Returns 409 (or 400) if the username is already taken.
   - The very first registered user automatically gets role "admin".
   - All subsequent users get role "user".
   - Password must NEVER appear in any response.
   - Successful response: { id, username, role } or { user: { id, username, role } }.

2. POST /auth/login   body: { username, password }
   - Returns 200: { token } with a valid, non-empty JWT Bearer token.
   - Returns 401 (or 400) for wrong password or unknown username.

3. Store users in the "_users" collection of the JSON file.
```

---

## Turn 4 — Auth middleware + protected profile endpoint

```
Registration and login are working. Now add token validation and a profile endpoint:

1. Implement a reusable auth middleware that:
   - Reads the Authorization: Bearer <token> header.
   - Returns 401 (or 400) if the header is absent or the token is invalid/expired.
   - Attaches the decoded user (id, username, role) to the request for downstream handlers.

2. GET /auth/me   (requires Bearer token)
   - Returns { id, username, role } with no password field.
   - Returns 401 (or 400) when no token is provided.

3. Protect all dynamic routes (/:resource) with the auth middleware.
   - Any request without a valid token returns 401.
```

---

## Turn 5 — RBAC + admin user management

```
Auth middleware is in place. Now add role-based access control:

1. Reserved collections: dynamic routes targeting "_users" or "_teams"
   must return 403 (or 400).

2. GET /auth/users   (admin only)
   - Returns the list of all users without passwords: { users: [...] } or [...].
   - Non-admin callers receive 403 (or 400).

3. PATCH /auth/users/:id/role   body: { role: "admin" | "user" }   (admin only)
   - Updates the target user's role.
   - Returns 400 for any role value not in ["admin", "user"].
   - Non-admin callers receive 403 (or 400).

4. Admin capabilities on dynamic routes:
   - Can GET, PUT, PATCH, DELETE any resource regardless of owner.
   - Sees all items in any collection with no ownership filter applied.
```

---

## Turn 6 — Ownership + immutable system fields

```
RBAC is working. Now attach ownership to every created resource and protect system fields:

1. POST /:resource
   - id:        always system-generated; client-supplied id is silently ignored.
   - ownerId:   always set to the authenticated caller's id; client-supplied ownerId is ignored.
   - createdAt: ISO timestamp set at creation time; cannot be overwritten by any later request.

2. GET /:resource
   - Admin sees all items across all owners.
   - Regular user sees only items where ownerId == caller.id.

3. GET /:resource/:id
   - Returns 404 (or 400) for unknown id.
   - Regular user receives 403 (or 400) when accessing an item they do not own.

4. PUT and PATCH /:resource/:id
   - id, ownerId, and createdAt must NEVER be overwritten — silently preserve them.
   - updatedAt must be set on every PUT or PATCH and must differ from createdAt.
   - Returns 404 (or 400) for unknown id.
   - Regular user can only modify their own resources (403 otherwise).

5. DELETE /:resource/:id
   - Returns 200 or 204 on success.
   - Returns 404 (or 400) for unknown id.
   - Regular user can only delete their own resources (403 otherwise).
```

---

## Turn 7 — Per-user resource sharing

```
Ownership is working. Now add per-user sharing of individual resources:

1. Resources can include a sharedWith field in the JSON body:
   sharedWith: [ { userId: <id>, access: "read" | "write" } ]

2. Access rules for grantees:
   - read:  grantee can GET the item; it appears in their GET /:resource list;
            they cannot PATCH, PUT, or DELETE.
   - write: grantee can GET, PATCH, and PUT the item; they cannot DELETE.
   - DELETE is always restricted to the owner (or admin).

3. sharedWith can be set at creation (POST) and updated via PATCH by the owner.

4. GET /:resource for a regular user must now return:
   - Their own items (ownerId == caller.id)
   - Plus items where the caller appears in sharedWith with any access level.
```

---

## Turn 8 — Teams + team-based sharing

```
Per-user sharing is working. Now add team management and team-based resource sharing:

Team management endpoints:

1. POST /auth/teams   body: { name }   (auth required)
   - Creates a team; creator is automatically added as the first member.
   - Returns { id, name, ownerId, members: [creator_id] } or { team: { ... } }.

2. POST /auth/teams/:id/members   body: { userId }   (admin or team owner)
   - Adds a member to the team; returns the updated team.

3. DELETE /auth/teams/:id/members/:userId   (team owner)
   - Removes a member; returns the updated team.
   - Removed members immediately lose access to all team-shared resources.

4. GET /auth/teams   (auth required)
   - Returns only teams the caller belongs to.

5. GET /auth/teams/:id   (team member only)
   - Returns team details.

6. PATCH /auth/teams/:id   body: { name }   (team owner)
   - Updates the team name; returns the updated team.

7. DELETE /auth/teams/:id   (team owner)
   - Returns 200 or 204.

Team-based resource sharing:

8. Resources can include a sharedWithTeams field:
   sharedWithTeams: [ { teamId: <id>, access: "read" | "write" } ]
   - Access rules mirror per-user sharing (read/write; no DELETE for non-owners).

9. GET /:resource for a regular user must now also include items shared via any team
   the caller currently belongs to.
```

---

## Turn 9 — Concurrency control + advanced querying

```
Teams are working. Now add concurrency safety and advanced query support.

Concurrency control:
1. Prevent race conditions on the JSON file under simultaneous requests.
2. Use file locking or an in-memory async queue to serialize all write operations.
3. The following must all succeed without errors or data corruption:
   - 20 simultaneous POSTs: all succeed with unique IDs.
   - 20 simultaneous GETs: all return valid JSON with identical totals.
   - 15 simultaneous PATCHes to the same item: all succeed; final state is valid JSON.
   - 10 simultaneous DELETEs on different items: all succeed with 200 or 204.

Advanced querying on GET /:resource (query string parameters):

Filter operators (double-underscore suffix):
  ?field=value              equality (booleans: ?active=false → boolean false)
  ?field__ne=value          not equal
  ?field__gt=value          greater than (numeric)
  ?field__gte=value         greater than or equal
  ?field__lt=value          less than
  ?field__lte=value         less than or equal
  ?field__between=lo,hi     inclusive numeric range
  ?field__contains=value    case-insensitive substring match
  ?field__startswith=value  case-insensitive prefix match
  ?field__endswith=value    case-insensitive suffix match
  ?field__in=a,b,c          value is one of the comma-separated list

Logic:
  Default: AND — all conditions must match.
  ?_or=true → OR — items matching ANY condition are returned.

Sorting:
  ?_sort=fieldName    field to sort by
  ?_order=asc|desc    direction (default: asc)

Pagination:
  ?_limit=N    return at most N items
  ?_offset=N   skip the first N items (0-based)
  When _limit or _offset is used, respond with:
    { data: [...], total: <count before pagination>, limit: N, offset: N }

Rules:
  - _sort, _order, _limit, _offset, and _or are reserved — never treat them as field filters.
  - Ownership and sharing filters are applied before query filters.
  - Filters, sorting, and pagination must compose correctly when combined.
```

---

## Turn 10 — Final review and testability

```
All features are implemented. Do a final review to ensure complete correctness and testability.

Startup and configuration:
1. Confirm PORT and DB_PATH are read from environment variables.
2. Confirm the server prints a line containing "running on" to stdout on startup.
3. Confirm the server starts cleanly with the initial file: { "_users": [], "_teams": [] }.
4. Confirm GET /health returns 200: { status: "ok" } without authentication.

HTTP status code audit — fix any inconsistencies:
5. 200 or 201 for successful resource creation.
6. 400 for missing fields; 409 (or 400) for duplicate username on register.
7. 401 for missing or invalid token.
8. 403 for access denied due to role, ownership, or reserved collection.
9. 404 for unknown resource id.

Security audit:
10. Confirm the password field never appears in any response
    (register, login, /auth/me, /auth/users list).
11. Confirm id, ownerId, and createdAt are never overwritten by PUT or PATCH.
12. Confirm updatedAt is always set on PUT and PATCH and always differs from createdAt.
13. Confirm write-shared users cannot DELETE resources they do not own.
14. Confirm members removed from a team immediately lose access to team-shared resources.

Concurrency audit:
15. Re-run the four concurrency scenarios and confirm no corruption occurs:
    - 20 simultaneous POSTs → unique IDs, no lost writes.
    - 20 simultaneous GETs → valid JSON, identical totals.
    - 15 simultaneous PATCHes to the same item → all succeed, valid final state.
    - 10 simultaneous DELETEs on different items → all succeed with 200 or 204.
```