import cors from 'cors';
import express from 'express';
import http from 'http';
import { createAuthRouter } from './auth.js';
import { DB_PATH, initializeDatabase } from './db.js';
import { attachWebSocketServer } from './websocket.js';

const FALLBACK_PORT = 3000;
const FALLBACK_ORIGIN = 'http://localhost:5173';
const servicePort = process.env.PORT || FALLBACK_PORT;
const allowedOrigin = process.env.FRONTEND_ORIGIN || FALLBACK_ORIGIN;

const api = express();
const listener = http.createServer(api);

api.use(cors({ origin: allowedOrigin, credentials: true }));
api.use(express.json());

api.use((_req, res, proceed) => {
  res.type('application/json');
  proceed();
});

api.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

try {
  const chatDatabase = await initializeDatabase();
  console.log(`SQLite database ready at ${DB_PATH}`);

  api.use('/auth', createAuthRouter({ express, db: chatDatabase }));
  attachWebSocketServer(listener, chatDatabase);

  api.use((error, _req, res, proceed) => {
    if (res.headersSent) {
      proceed(error);
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  listener.listen(servicePort, () => {
    console.log(`Server listening on port ${servicePort}`);
  });
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
}
