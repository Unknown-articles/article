# Real-Time Chat Application

A full-stack real-time chat application with React frontend and Node.js backend.

## Features

- User registration and login
- Real-time messaging via WebSocket
- Message persistence with SQLite
- JWT-based authentication
- Responsive UI

## Project Structure

```
/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── db.js
│   ├── auth.js
│   ├── websocket.js
│   └── .env
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── App.css
        ├── index.css
        └── components/
            ├── AuthForm.jsx
            ├── Chat.jsx
            ├── MessageList.jsx
            ├── Message.jsx
            └── MessageInput.jsx
```

## Setup

### Backend

1. Navigate to backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Start the server: `npm start`

### Frontend

1. Navigate to frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Usage

1. Open the frontend at http://localhost:5173
2. Register a new account or login
3. Start chatting in real-time

## API Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /health` - Health check
- `WS /?token={JWT}` - WebSocket connection

## Environment Variables

### Backend (.env)

- `PORT=3000`
- `DB_PATH=./chat.db`
- `JWT_SECRET=your-secret-key`
- `FRONTEND_ORIGIN=http://localhost:5173`