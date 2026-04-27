# Real-Time Chat Application

A full-stack real-time chat application with authentication, built using React, Node.js, WebSocket, and SQLite.

## Features

- User registration and login
- Real-time messaging via WebSocket
- Message history persistence in SQLite
- JWT-based authentication
- Responsive UI with React

## Project Structure

```
/
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── AuthForm.jsx
│           ├── Chat.jsx
│           ├── MessageList.jsx
│           ├── Message.jsx
│           └── MessageInput.jsx
└── README.md
```

## Setup and Installation

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env` (JWT_SECRET should be a strong secret).

4. Start the server:
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:3000`.

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
   The frontend will run on `http://localhost:5173`.

## Usage

1. Open the frontend in your browser at `http://localhost:5173`.
2. Register a new account or login with existing credentials.
3. Start chatting in real-time with other connected users.

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login an existing user
- `GET /health` - Health check

### WebSocket
- Connect to `ws://localhost:3000?token={JWT_TOKEN}`
- Send messages with `{ type: "message", content: "Hello" }`
- Receive messages, history, and errors

## Database Schema

### Users Table
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT UNIQUE)
- `password` (TEXT)
- `created_at` (TEXT)

### Messages Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER)
- `username` (TEXT)
- `content` (TEXT)
- `timestamp` (TEXT)

## Technologies Used

- **Backend**: Node.js, Express, WebSocket (ws), SQLite, bcrypt, JWT
- **Frontend**: React, Vite
- **Database**: SQLite
- **Communication**: WebSocket for real-time messaging