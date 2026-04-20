## Turn 1 — Backend: project setup + health endpoint

```
Create a Node.js backend using ES Modules (not CommonJS) with Express.

Project requirements:
- Entry point: src/index.js
- Default port: 3000 (configurable via PORT env var)
- All JSON responses must set Content-Type: application/json
- Backend must accept CORS from http://localhost:5173
  (configurable via FRONTEND_ORIGIN env var, default: "http://localhost:5173")
  Use: app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))

Implement one endpoint:
  GET /health
    200: { status: "ok", timestamp: "<ISO 8601 current server time>" }
    The timestamp must be new Date().toISOString() — current server time, not a static string.

Deliver the full project structure with all source files.
The server must start and respond to GET /health at the end of this step.
Use Git for source control (one commit per feature)
```

---

## Turn 2 — Backend: database schema + initialization

```
The server is running. Now add SQLite and initialize the database schema.

Database requirements:
- SQLite file path configurable via DB_PATH env var (default: ./chat.db)
- Create both tables on startup if they do not already exist.

Table schemas (do not rename columns — these exact names are required):
  users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )

  messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    username  TEXT NOT NULL,
    content   TEXT NOT NULL,
    timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )

Important: use strftime('%Y-%m-%dT%H:%M:%SZ', 'now') as the SQLite default
for all timestamp columns — never datetime('now').

The server must start cleanly with a brand-new empty database file
and with an already-initialized database (idempotent startup).

Keep GET /health working.
Deliver all updated source files.
```

---

## Turn 3 — Backend: user registration

```
The database schema is in place. Now implement user registration.

POST /auth/register   body: { username, password }

Validation — return 400 for any of these:
  - username is missing
  - username is shorter than 3 characters
  - password is missing
  - password is shorter than 6 characters
  Error shape: { "error": "<validation message>" }

Conflict — return 409 when username is already taken:
  { "error": "Username already taken" }
  The error message must contain "taken" or "already".

Success — return 201:
  { token, userId, username }
  - token: a signed JWT encoding at minimum userId and username
  - userId: the database-assigned integer id
  - username: the registered username

Security:
- Store passwords hashed — never plaintext.
- The password field must never appear in any response.
- All error responses must use the shape: { "error": "<message>" } — no other shape.

Keep all functionality from previous turns working.
Deliver all updated source files.
```

---

## Turn 4 — Backend: user login + auth middleware

```
Registration is working. Now implement login and a reusable auth middleware.

POST /auth/login   body: { username, password }

Validation — return 400 when username or password is missing:
  { "error": "<validation message>" }

Auth failure — return 401 for wrong password or unknown username:
  { "error": "Invalid credentials" }

Success — return 200:
  { token, userId, username }
  - token: a signed JWT encoding at minimum userId and username
  - userId: the database-assigned integer id
  - username: the username

Auth middleware:
- Implement a reusable middleware function that reads the Authorization: Bearer <token> header.
- Decodes and verifies the JWT.
- Attaches the decoded user (userId, username) to the request object for downstream handlers.
- Returns 401 { "error": "Unauthorized" } when the header is absent or token is invalid.
- This middleware will be used by the WebSocket upgrade handler in a later turn.

Keep all functionality from previous turns working.
Deliver all updated source files.
```

---

## Turn 5 — Backend: WebSocket server + token authentication

```
Auth endpoints are working. Now add the WebSocket server with token-based authentication.

WebSocket server:
- Attach a WebSocket server to the existing HTTP server (same port, no separate port).
- Accept upgrade requests at: ws://localhost:{PORT}?token={JWT}
- On every new connection, extract the token from the URL query string and validate it:
    - No token present       → close immediately with code 4001
                               (meaning: authentication required)
    - Token invalid/expired  → close immediately with code 4002
                               (meaning: invalid or expired token)
    - Token valid            → proceed; store the decoded user (userId, username)
                               on the connection object for use in message handlers

Handle disconnection cleanly:
- Maintain a registry of all authenticated connected clients.
- Remove the client from the registry immediately on disconnect.
- Remaining clients must continue operating unaffected.

Do not send any messages after connection yet — that comes in Turn 6.

Keep all functionality from previous turns working.
Deliver all updated source files.
```

---

## Turn 6 — Backend: message history + broadcasting

```
WebSocket authentication is working. Now implement message history delivery
and real-time broadcasting.

On successful connection (after token validation passes):
  1. Query the messages table for the last 50 stored messages, ordered oldest first.
  2. Immediately send a history message to the newly connected client:
       { type: "history", messages: Message[] }
     where each Message is:
       { id, userId, username, content, timestamp }
     timestamp must be an ISO 8601 string.

Client → server message (the only type clients send):
  { type: "message", content: string }

On receiving a valid message from an authenticated client:
  1. Save the message to the messages table BEFORE broadcasting.
     Use the authenticated user's userId and username from the token.
     timestamp must be an ISO 8601 string (use strftime, not datetime('now')).
  2. Read back the saved row (to get the database-assigned id and timestamp).
  3. Broadcast to ALL connected authenticated clients (including the sender):
       { type: "message", id, userId, username, content, timestamp }

Error handling — send { type: "error", message: string } for:
  - Invalid JSON received from a client
  - Missing or empty content field in the message
  - Any other malformed message payload

The connection must stay open after sending an error message.

Keep all functionality from previous turns working.
Deliver all updated source files.
```

---

## Turn 7 — Frontend: project setup + auth form UI

```
The backend is fully working. Now create the React frontend.

Project setup:
- Use Vite as the build tool (default port 5173).
- Place the frontend in a separate directory alongside the backend (e.g. client/).

Implement an AuthForm with exactly these data-testid attributes:

  data-testid="auth-form"        → the <form> element
                                   also carries data-mode="login" or data-mode="register"
  data-testid="tab-login"        → the Login tab button
  data-testid="tab-register"     → the Register tab button
  data-testid="input-username"   → the username <input>
                                   must have minlength="3"
  data-testid="input-password"   → the password <input>
  data-testid="btn-submit"       → the submit button
                                   must have type="submit"
  data-testid="auth-error"       → the error message element
                                   rendered only when an error exists; hidden otherwise

Auth form behavior:
- Start in login mode: data-mode="login" on first render.
- Switching tabs updates data-mode and clears any existing auth-error immediately.
- type="submit" on btn-submit means both click and Enter key trigger submission.
- minlength="3" on input-username lets the browser block short names natively.
- auth-form must NOT be rendered once the user is logged in.

Do not implement the API calls or session logic yet — that comes in Turn 8.
Render a placeholder <div> where the Chat view will go after login.

Deliver the full frontend project structure with all source files.
```

---

## Turn 8 — Frontend: auth logic + session persistence

```
The auth form renders correctly. Now wire up the API calls and session management.

On form submission:
  - Login mode:    POST http://localhost:3000/auth/login    { username, password }
  - Register mode: POST http://localhost:3000/auth/register { username, password }
  - On success: store credentials in localStorage using exactly these keys:
      "chat_token" → the JWT string
      "chat_user"  → JSON.stringify({ userId, username })
    Then hide AuthForm and show the Chat view.
  - On failure: render the error message in data-testid="auth-error".

Session persistence:
- On page load, check localStorage for both "chat_token" and "chat_user".
- If both are present, restore the session automatically:
    parse chat_user, skip the auth form entirely, go straight to the Chat view.
- If either is missing, show the auth form.

Logout behavior (wire up to the logout button that will be added in Turn 9):
- Remove both "chat_token" and "chat_user" from localStorage.
- Disconnect any open WebSocket connection.
- Return to the auth form.

Keep all frontend functionality from Turn 7 working.
Deliver all updated frontend source files.
```

---

## Turn 9 — Frontend: chat UI + WebSocket integration

```
Auth logic and session persistence are working. Now implement the full Chat view
and WebSocket connection.

WebSocket connection:
- After authentication (or session restore), connect to:
    ws://localhost:3000?token={chat_token}
- On close code 4001 or 4002: clear localStorage ("chat_token" and "chat_user")
  and show the auth form.

Chat — implement with exactly these data-testid attributes:

  data-testid="chat-container"     → the root chat div (visible when logged in)
  data-testid="connection-status"  → online/offline indicator
                                     also carries data-connected="true" when open,
                                     data-connected="false" otherwise
  data-testid="current-username"   → displays the logged-in username
  data-testid="btn-logout"         → the logout button; clears localStorage,
                                     disconnects WebSocket, shows auth-form
  data-testid="connection-error"   → error banner; rendered only when an error exists

MessageList:
  data-testid="message-list"       → the scrollable message container
                                     auto-scrolls to the latest message on every update
  data-testid="message-empty"      → empty-state element; rendered only when messages array is empty

Message (one per message):
  data-testid="message-item"       → the message bubble wrapper; also carries:
                                       data-own="true|false"
                                         (true when message.userId == current user's userId)
                                       data-message-id="{id}"
                                         (the server-assigned numeric message id)
  data-testid="message-username"   → shows "You" for own messages; actual username for others
  data-testid="message-content"    → the message text
  data-testid="message-timestamp"  → the time in HH:MM format derived from the ISO 8601 timestamp

MessageInput:
  data-testid="input-message"      → the text input
  data-testid="btn-send"           → the send button
                                     disabled attribute when input-message is empty
                                     enabled when input-message has at least one character

MessageInput behavior:
- Pressing Enter inside input-message sends the message (same as clicking btn-send).
- After sending, clear input-message (reset value to "").
- Send over WebSocket: { type: "message", content: "<trimmed input value>" }

Handling incoming WebSocket messages:
  type: "history"  → replace the messages array; render all in MessageList
  type: "message"  → append to the messages array; auto-scroll to bottom
  type: "error"    → display text in connection-error banner

Keep all functionality from previous turns working.
Deliver all updated frontend source files.
```

---

## Turn 10 — Integration review + final audit

```
All features are implemented. Do a full integration audit across backend and frontend.

Backend audit:
1. Confirm GET /health returns 200: { status: "ok", timestamp: "<ISO 8601>" }
   where timestamp is the current server time (new Date().toISOString()).
2. Confirm POST /auth/register rejects with 400 when username < 3 chars or password < 6 chars.
3. Confirm POST /auth/register returns 409 with an error message containing "taken" or "already"
   for duplicate usernames.
4. Confirm POST /auth/login returns 401: { error: "Invalid credentials" }
   for wrong password or unknown username.
5. Confirm passwords are stored hashed — verify no plaintext password exists in the DB.
6. Confirm WebSocket connections without a token are closed with code 4001.
7. Confirm WebSocket connections with an invalid or expired token are closed with code 4002.
8. Confirm the first WebSocket message sent to a new client is always type: "history".
9. Confirm messages are saved to the database BEFORE being broadcast.
10. Confirm all message timestamps are ISO 8601 strings produced by strftime, not datetime('now').
11. Confirm all error responses use exactly: { "error": "<message>" } — no other shape.
12. Confirm disconnected clients are removed from the registry and do not affect other clients.

Frontend audit:
13. Confirm auth-form renders with data-mode="login" on first load.
14. Confirm switching tabs clears auth-error immediately and updates data-mode.
15. Confirm session is restored automatically on page load when both
    chat_token and chat_user are present in localStorage.
16. Confirm logout removes both chat_token and chat_user and shows the auth form.
17. Confirm data-connected="true" when WebSocket is open, "false" otherwise.
18. Confirm each message-item carries correct data-own and data-message-id attributes.
19. Confirm message-username shows "You" for own messages and the sender's username for others.
20. Confirm message-timestamp displays in HH:MM format.
21. Confirm btn-send is disabled when input-message is empty and enabled otherwise.
22. Confirm pressing Enter in input-message sends the message and clears the field.
23. Confirm message-list auto-scrolls to the latest message after every update.
24. Confirm message-empty is shown when the messages array is empty and hidden otherwise.

Deliver the complete final project structure for both backend and frontend with all source files.
```