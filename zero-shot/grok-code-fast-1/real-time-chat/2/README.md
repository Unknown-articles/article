# Real-Time Chat Application

A full-stack real-time chat application with React frontend and Node.js backend.

## Features

- User registration and login
- Real-time messaging via WebSocket
- SQLite database for persistence
- JWT authentication
- Responsive UI

## Project Structure

```
/
├── backend/
│   ├── db.js
│   ├── auth.js
│   ├── websocket.js
│   ├── routes/
│   │   └── auth.js
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AuthForm.jsx
    │   │   ├── Chat.jsx
    │   │   ├── MessageList.jsx
    │   │   ├── Message.jsx
    │   │   └── MessageInput.jsx
    │   ├── hooks/
    │   │   └── useWebSocket.js
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    └── index.html
```

## Setup

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open the frontend at http://localhost:5173
2. Register a new account or login
3. Start chatting in real-time

## API Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/health` - Health check
- `WS ws://localhost:3000?token={JWT}` - WebSocket connection