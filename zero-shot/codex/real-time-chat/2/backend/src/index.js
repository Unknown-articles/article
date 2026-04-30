import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { login, register } from './auth.js';
import { initDb } from './db.js';
import { attachWebSocketServer } from './websocket.js';

export const PORT = Number(process.env.PORT || 5000);
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = new Set([FRONTEND_ORIGIN, 'http://localhost:5273']);

export function createApp() {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(async (_req, _res, next) => {
    try {
      await initDb();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/register', register);
  app.post('/auth/login', login);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  await initDb();

  const app = createApp();
  const server = http.createServer(app);
  attachWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`Chat API listening on http://localhost:${PORT}`);
  });
}
