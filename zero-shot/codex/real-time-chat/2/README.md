# Real-Time Chat

Full-stack real-time chat application using React, Node.js ES modules, WebSocket, and SQLite.

## Project Structure

```text
.
├── backend/
│   ├── package.json
│   └── src/
│       ├── auth.js
│       ├── db.js
│       ├── index.js
│       └── websocket.js
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── AuthForm.jsx
│       │   ├── Chat.jsx
│       │   ├── Message.jsx
│       │   ├── MessageInput.jsx
│       │   └── MessageList.jsx
│       ├── main.jsx
│       └── styles.css
├── package.json
└── README.md
```

## Run

```bash
npm install
npm run dev
```

Backend defaults to `PORT=5000` and `DB_PATH=./chat.db`.
Frontend runs at `http://localhost:5273`.
