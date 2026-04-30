import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRouter from './auth.js';
import { setupWebSocket } from './websocket.js';
import { getDb } from './database.js';

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5273';

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// Initialize DB on startup
getDb();

app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
