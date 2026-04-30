import 'dotenv/config';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { FRONTEND_ORIGINS, PORT } from './config.js';
import { initializeDatabase } from './db.js';
import { authRouter } from './routes/authRoutes.js';
import { attachWebSocketServer } from './websocket.js';

initializeDatabase();

const app = express();

app.use(cors({ origin: FRONTEND_ORIGINS, credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Chat backend listening on http://localhost:${PORT}`);
});
