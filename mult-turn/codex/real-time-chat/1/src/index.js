import cors from 'cors';
import express from 'express';
import http from 'http';
import { createAuthRouter } from './auth.js';
import { DB_PATH, initializeDatabase } from './db.js';
import { attachWebSocketServer } from './websocket.js';

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
  res.type('application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

try {
  const db = await initializeDatabase();
  console.log(`SQLite database ready at ${DB_PATH}`);

  app.use('/auth', createAuthRouter({ express, db }));
  attachWebSocketServer(server, db);

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
}
