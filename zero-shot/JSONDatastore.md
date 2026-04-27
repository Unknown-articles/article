Create a REST API using JavaScript (Node.js) and the Express framework with the following requirements:

GENERAL

- Use a file-based database (JSON file) to persist data.
- The API must be generic and dynamic, allowing creation of resources based on any route (e.g., /users, /products, etc.).
- All data must be stored in a structured JSON format.

CORE FEATURES

1. Dynamic Resource Handling
    - The API must accept any JSON payload.
    - A POST request to any route (e.g., POST /users) must create a new resource collection if it does not exist.
    - Data should be stored under a key corresponding to the route name.
2. CRUD Operations
    - Implement GET, POST, PUT, PATCH, DELETE for all dynamic routes.
    - GET should support retrieving all items or a single item by ID.
    - Automatically generate unique IDs for each resource.
3. Persistence
    - All data must be stored in a single `.json` file.
    - Ensure safe read/write operations.
4. Authentication
    - Implement token-based authentication (e.g., JWT).
    - Provide login/register endpoints.
5. Role-Based Access Control (RBAC)
    - Support roles such as `admin`, `user`.
    - Restrict certain operations based on roles.
6. Data Ownership
    - Each resource must be associated with a user (ownerId).
    - Only the owner or an admin can modify/delete the resource.
7. Shared Ownership
    - Support sharing resources with other users or groups (teams/orgs).
    - Define access rules for shared entities.
8. Concurrency Control
    - Prevent race conditions when reading/writing the JSON file.
    - Use file locking or an in-memory queue mechanism.
9. Advanced Querying
    - Implement filtering:
        - equality (=)
        - inequality (!=)
        - greater/less than (>, <, >=, <=)
        - between values
        - string matching (contains/like)
    - Support logical operators (AND, OR)
    - Sorting (asc/desc)
    - Pagination (limit, offset)

DEVELOPMENT PROCESS

- Implement each feature incrementally.
- Each feature must correspond to a separate Git commit.
- Ensure every step results in a fully working system.

OUTPUT

- Provide the full project structure.
- Include all source files.

TESTABILITY

Server Configuration

- Server entry point: src/index.js
- Default port: 4000, configurable via PORT env var
- When the server is ready it must print a line to stdout that contains the word "running on"
  (the test harness waits for this string before starting tests)
- The JSON database file path must be configurable via DB_PATH env var
  (the test harness passes a temporary file so each run starts with a clean state)
- The initial empty DB file will have the shape: { "_users": [], "_teams": [] }
  The server must handle this without error on startup

Health Endpoint

  GET /health
    200: { status: "ok" }

Auth — Register

  POST /auth/register   body: { username, password }
    200 or 201: { id, username, role, ... }   ← or wrapped as { user: { id, username, role } }
    Constraints:
      - First ever registered user automatically gets role "admin"
      - Every subsequent user gets role "user"
      - Password must NEVER appear in any response (register, login, /me, /users list)
      - Returns 400 when username or password is missing
      - Returns 409 or 400 when username is already taken

Auth — Login

  POST /auth/login   body: { username, password }
    200: { token }   ← JWT Bearer token; must be a non-empty string
    401 or 400: for wrong password
    401 or 400: for unknown username

Auth — Me / Profile

  GET /auth/me   (requires Bearer token)
    200: { id, username, role, ... }   ← no password field
    401 or 400: when no token provided

Auth — User Management (admin only)

  GET /auth/users   (admin token required)
    200: { users: [...] }  or  [ ... ]   ← array of user objects; no passwords
    403 or 400: for non-admin callers

  PATCH /auth/users/:id/role   body: { role: "admin"|"user" }   (admin only)
    200: { id, username, role }  or  { user: { ... } }
    400: for any role value not in ["admin", "user"]
    403 or 400: for non-admin callers

Dynamic Resources — CRUD

  POST /:resource   body: any JSON object   (auth required)
    200 or 201: created item with system-generated fields:
      id        ← always system-generated; client-supplied id is silently ignored
      ownerId   ← always set to the authenticated caller's id; client-supplied ownerId is ignored
      createdAt ← ISO timestamp set at creation time; cannot be overwritten
    The route /:resource creates the collection automatically if it doesn't exist.

  GET /:resource   (auth required)
    200: array  [ {...}, ... ]
      OR envelope  { data: [...], total: number, limit?: number, offset?: number }
    Admin sees ALL items across all owners.
    Regular user sees ONLY their own items (and items shared with them — see Sharing).
    401 or 400: when no token is provided

  GET /:resource/:id   (auth required)
    200: single item object
    404 or 400: for unknown id

  PUT /:resource/:id   body: full replacement JSON   (auth required)
    200: updated item — system fields (id, ownerId, createdAt) must be preserved
    404 or 400: for unknown id

  PATCH /:resource/:id   body: partial JSON   (auth required)
    200: updated item — only supplied fields are changed; updatedAt must differ from createdAt
    404 or 400: for unknown id

  DELETE /:resource/:id   (auth required)
    200 or 204: on success
    404 or 400: for unknown id

System Fields — Immutability

  id, ownerId, and createdAt must NEVER be overwritten by a PATCH or PUT request.
  updatedAt must be updated on every PATCH or PUT.

Reserved Collections

  The following collection names must be rejected with 403 or 400:
    _users   — internal user store
    _teams   — internal team store
  Routes starting with /auth are handled by the auth router and are not dynamic resources.

Role-Based Access Control

  Admin:
    - Can GET, PUT, PATCH, DELETE any resource regardless of owner
    - Can list all items in any collection (no ownership filter)

  Regular user:
    - Can GET, PUT, PATCH their own resources only
    - Can DELETE only resources they own
    - Cannot GET, PUT, PATCH, DELETE resources owned by other users (403 or 400) unless sharing grants access
    - List (/resource) must return only the caller's own items plus items shared with them

Sharing — Per-User

  Resources can include a sharedWith field in the JSON body:
    sharedWith: [ { userId: <id>, access: "read" | "write" } ]

  Access rules:
    read  → grantee can GET the item; it appears in their list; they cannot PATCH/PUT/DELETE
    write → grantee can GET, PATCH, PUT the item; they cannot DELETE (owner-only)
    DELETE is always restricted to the owner (or admin); write-shared users cannot delete

  sharedWith can be updated via PATCH on the resource.

Sharing — Teams

  Teams are managed under /auth/teams:

  POST /auth/teams   body: { name }   (auth required)
    200 or 201: { id, name, ownerId, members: [creator_id] }  or  { team: { ... } }
    Creator is automatically added as the first member.

  POST /auth/teams/:id/members   body: { userId }   (admin or team owner)
    200: updated team with the new member in members array

  DELETE /auth/teams/:id/members/:userId   (team owner)
    200: updated team without the removed member

  GET /auth/teams   (auth required)
    200: [ {...} ]  or  { teams: [...] }  ← only teams the caller belongs to

  GET /auth/teams/:id   (auth required — team member only)
    200: { id, name, ownerId, members: [...] }  or  { team: {...} }

  PATCH /auth/teams/:id   body: { name }   (team owner)
    200: updated team

  DELETE /auth/teams/:id   (team owner)
    200 or 204

  Resources can include a sharedWithTeams field:
    sharedWithTeams: [ { teamId: <id>, access: "read" | "write" } ]

  Team access rules mirror per-user sharing rules:
    read  → team members can GET the item; it appears in their list; no PATCH/DELETE
    write → team members can GET, PATCH, PUT; cannot DELETE
    After a member is removed from a team, they lose access to team-shared resources.

Advanced Querying (Query String Parameters)

  All filter/sort/pagination params are passed as query strings on GET /:resource.
  These params must NOT be treated as resource data filters based on stored fields alone —
  _sort, _order, _limit, _offset, _or are reserved control params.

  Filter operators (double-underscore suffix):
    ?field=value              equality (also works for booleans: ?active=false → boolean false)
    ?field__ne=value          not equal
    ?field__gt=value          greater than (numeric)
    ?field__gte=value         greater than or equal
    ?field__lt=value          less than
    ?field__lte=value         less than or equal
    ?field__between=lo,hi     inclusive range (numeric)
    ?field__contains=value    case-insensitive substring match
    ?field__startswith=value  case-insensitive prefix match
    ?field__endswith=value    case-insensitive suffix match
    ?field__in=a,b,c          value is one of the comma-separated list

  Logic:
    Default: AND — all conditions must match
    ?_or=true — OR — items matching ANY condition are returned

  Sorting:
    ?_sort=fieldName          field to sort by
    ?_order=asc|desc          direction (default asc)

  Pagination:
    ?_limit=N                 return at most N items
    ?_offset=N                skip the first N items (0-based)
    When _limit or _offset is used, the response envelope must include:
      total  ← total matching items before pagination
      limit  ← the _limit value used
      offset ← the _offset value used

  Paginated response shape:
    { data: [...], total: number, limit: number, offset: number }

  Filters, sorting, and pagination must compose correctly when combined.
  Ownership/sharing filters apply before query filters.

Concurrency

  The server must not corrupt the JSON file under concurrent requests:
    - 20 simultaneous POSTs must all succeed with unique IDs
    - 20 simultaneous GETs must all return valid JSON arrays with identical totals
    - 15 simultaneous PATCHes to the same item must all succeed; final state must be valid JSON
    - 10 simultaneous DELETEs on different items must all succeed with 200 or 204