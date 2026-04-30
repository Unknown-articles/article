# Real-Time Chat

This repository contains a simple real-time chat application with:

- Backend: Node.js + Express + WebSocket + SQLite
- Frontend: React + Vite

## Setup

### Backend

1. `cd backend`
2. `npm install`
3. `npm start`

The backend defaults to port `5000` and uses `./chat.db` unless `DB_PATH` is set.

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev`

The frontend runs on port `5273`.

## Environment

Backend environment variables:

- `PORT` - default `5000`
- `DB_PATH` - default `./chat.db`
- `FRONTEND_ORIGIN` - default `http://localhost:5173`
- `JWT_SECRET` - default `change_this_secret`

Frontend environment variables can be configured through Vite if needed.
