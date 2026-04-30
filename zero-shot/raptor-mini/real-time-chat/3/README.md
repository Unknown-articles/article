# Real-Time Chat Application

This project contains a full-stack real-time chat application:

- `backend/` — Node.js + Express + WebSocket + SQLite
- `frontend/` — React + Vite

## Run

1. Install backend dependencies:
   - `cd backend && npm install`
2. Install frontend dependencies:
   - `cd frontend && npm install`
3. Start backend:
   - `cd backend && npm start`
4. Start frontend:
   - `cd frontend && npm run dev`

## Defaults

- Backend port: `5000`
- Frontend port: `5273`
- SQLite DB path: `./chat.db`
- Frontend origin allowed by CORS: `http://localhost:5173`
