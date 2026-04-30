# Real-Time Chat

Full-stack chat application with React, Node.js ES Modules, WebSocket messaging, and SQLite persistence.

## Project Structure

```text
.
├── backend
│   ├── package.json
│   └── src
│       ├── auth.js
│       ├── config.js
│       ├── db.js
│       ├── messages.js
│       ├── routes
│       │   └── authRoutes.js
│       ├── server.js
│       └── websocket.js
└── frontend
    ├── index.html
    ├── package.json
    └── src
        ├── api.js
        ├── App.jsx
        ├── components
        │   ├── AuthForm.jsx
        │   ├── Chat.jsx
        │   ├── Message.jsx
        │   ├── MessageInput.jsx
        │   └── MessageList.jsx
        ├── main.jsx
        ├── storage.js
        └── styles.css
```

## Backend

```bash
cd backend
npm install
npm start
```

Environment variables:

- `PORT`, default `5000`
- `DB_PATH`, default `./chat.db`
- `FRONTEND_ORIGIN`, default `http://localhost:5173`
- `JWT_SECRET`, default development secret

REST endpoints:

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`

WebSocket endpoint:

- `ws://localhost:{PORT}?token={JWT}`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on port `5273`.
