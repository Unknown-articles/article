Create a real-time chat application with:

- Frontend: React (functional components + hooks)
- Backend: Node.js (JavaScript, ES Modules)
- Communication: WebSocket
- Database: SQLite

GENERAL REQUIREMENTS

- The system must support real-time messaging between multiple users.
- Users must be authenticated before sending messages.

BACKEND FEATURES

WebSocket Server

- Implement a WebSocket server for real-time communication
- Handle:
    - client connection
    - message events
    - disconnection

Messaging

- Users can send messages to a shared chat room
- Broadcast messages to all connected clients
- Each message must include:
    - id
    - userId
    - username
    - content
    - timestamp (ISO 8601 string)

Persistence (SQLite)

- Store:
    - users
    - messages
- Messages must be saved before broadcasting
- Provide database schema and initialization
- The SQLite file path must be configurable via DB_PATH env var (default: ./chat.db)
- Table schemas must remain stable (no renames):
    - users:    id, username, password, created_at
    - messages: id, user_id, username, content, timestamp

Authentication

- Implement basic authentication:
    - register (username + password)
    - login (username + password)
- Store hashed passwords in the database
- Return a token or session identifier

Authorization

- Only authenticated users can connect/send messages
- Validate user identity on WebSocket connection

REST API (for auth)

- POST /auth/register
- POST /auth/login
- GET /health

All error responses must use the shape: { "error": "<message>" }

Auth endpoints must return exactly:

  POST /auth/register  201: { token, userId, username }
                       400: { error: "<validation message>" }
                       409: { error: "Username already taken" }

  POST /auth/login     200: { token, userId, username }
                       400: { error: "<validation message>" }
                       401: { error: "Invalid credentials" }

  GET /health          200: { status: "ok", timestamp: "<ISO 8601>" }

WebSocket Protocol

- Accept connections at: ws://localhost:{PORT}?token={JWT}
- Use custom close codes consistently:
    - 4001 → authentication required (no token)
    - 4002 → invalid or expired token
- Message types sent by the server must be exactly:
    - "history"  → { type: "history", messages: Message[] }
    - "message"  → { type: "message", id, userId, username, content, timestamp }
    - "error"    → { type: "error", message: string }
- Message type sent by the client must be exactly:
    - "message"  → { type: "message", content: string }
- Message history must be sent as the first event immediately after connection

FRONTEND FEATURES

Chat UI

- Display message list in real-time
- Input field to send messages
- Show username and timestamp

Authentication UI

- Login and registration forms with tabs to switch between modes
- Store auth token on client side using exactly these localStorage keys:
    - "chat_token" → JWT string
    - "chat_user"  → JSON object { userId, username }

WebSocket Integration

- Connect after authentication
- Send messages
- Receive real-time updates

State Management

- Manage messages and user session
- Ensure UI updates reactively

Basic UX

- Auto-scroll to latest message
- Handle connection errors gracefully

TESTABILITY — Frontend

Apply the following data-testid attributes to every interactive and observable element:

Auth Form (AuthForm component)
- data-testid="auth-form"           → the <form> element
- data-testid="tab-login"           → the Login tab button
- data-testid="tab-register"        → the Register tab button
- data-testid="input-username"      → the username <input>
- data-testid="input-password"      → the password <input>
- data-testid="btn-submit"          → the submit button
- data-testid="auth-error"          → the error message element (only rendered when an error exists)

Chat Container (Chat component)
- data-testid="chat-container"      → the root chat div
- data-testid="connection-status"   → the online/offline indicator
- data-testid="current-username"    → the logged-in username display
- data-testid="btn-logout"          → the logout button
- data-testid="connection-error"    → the error banner (rendered only when error exists)

Message List (MessageList component)
- data-testid="message-list"        → the scrollable message container
- data-testid="message-empty"       → the empty-state element (only rendered when messages array is empty)

Message (Message component)
- data-testid="message-item"        → each message bubble wrapper
- data-testid="message-username"    → the sender name element
- data-testid="message-content"     → the message text element
- data-testid="message-timestamp"   → the timestamp element

Message Input (MessageInput component)
- data-testid="input-message"       → the text input
- data-testid="btn-send"            → the send button

State Attributes

- data-testid="connection-status" must also carry:
    data-connected="true|false"
- data-testid="auth-form" must also carry:
    data-mode="login|register"     (changes when tabs are switched)
- data-testid="message-item" must also carry:
    data-own="true|false"          (true when message belongs to current user)
    data-message-id="{id}"         (the server-assigned numeric message id)

Auth Form Behaviour

- The form must start in login mode (data-mode="login" on first render)
- Switching tabs must clear any existing auth-error immediately
- auth-form must NOT be visible once the user is logged in (chat-container takes over)
- input-username must have minlength="3" so the browser blocks submission natively for short names
- btn-submit must have type="submit" so both click and Enter trigger form submission

Message Input Behaviour

- btn-send must be disabled (disabled attribute) when input-message is empty
- btn-send must be enabled when input-message has at least one character
- Pressing Enter inside input-message must send the message (same as clicking btn-send)
- After a message is sent, input-message must be cleared (value reset to "")

Message Display Rules

- message-username must show "You" (not the actual username) for messages sent by the current user
- message-username must show the sender's actual username for messages from other users
- message-timestamp must display in HH:MM format (e.g. "14:32"), derived from the ISO 8601 timestamp

Session Persistence

- On page load, if chat_token and chat_user are present in localStorage, restore the session
  automatically — the user must see chat-container without having to log in again
- On logout, remove both chat_token and chat_user from localStorage and show auth-form

TESTABILITY — Backend

Ports and CORS

- Backend default port must be 5000 (configurable via PORT env var)
- Frontend runs on port 5273 (Vite default)
- Backend must accept CORS requests from http://localhost:5273
  Use: FRONTEND_ORIGIN env var (default: "http://localhost:5273")
  Example: app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))

Health Endpoint

- GET /health must always return 200 { status: "ok", timestamp: "<ISO 8601>" }
- The timestamp must be the current server time in ISO 8601 format (e.g. new Date().toISOString())

Auth Validation Rules

- POST /auth/register must reject with 400 if:
    - username is missing or shorter than 3 characters
    - password is missing or shorter than 6 characters
- POST /auth/login must reject with 401 and { error: "Invalid credentials" } for:
    - wrong password
    - username that does not exist
- The 409 conflict error message must contain "taken" or "already" (e.g. "Username already taken")

General

- The SQLite file must be located at a path configurable via DB_PATH env var (default: ./chat.db)
- All error responses must be { "error": "<message>" } — no other shape
- WebSocket close codes 4001 and 4002 must be used exactly as specified above
- All timestamps in WebSocket messages and DB records must be ISO 8601 strings
  Use strftime('%Y-%m-%dT%H:%M:%SZ', 'now') as SQLite column default, not datetime('now')

DEVELOPMENT PROCESS

- Implement each feature incrementally
- Each feature must correspond to a separate Git commit, only one git repository for front-end and back-end
- Each step must result in a working system

OUTPUT

- Provide full project structure (frontend + backend)
- Include all source files
