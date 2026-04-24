import cors from 'cors';
import express from 'express';
import http from 'http';
import { createAuthRouter } from './auth.js';
import { DB_PATH, initializeDatabase } from './db.js';
import { attachWebSocketServer } from './websocket.js';

const DEFAULT_PORT = 3000;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
const port = process.env.PORT || DEFAULT_PORT;
const frontendOrigin = process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN;

const webApp = express();
const httpServer = http.createServer(webApp);

webApp.use(cors({ origin: frontendOrigin, credentials: true }));
webApp.use(express.json());

webApp.use((req, res, nextMiddleware) => {
  res.type('application/json');
  nextMiddleware();
});

webApp.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

try {
  const database = await initializeDatabase();
  console.log(`SQLite database ready at ${DB_PATH}`);

  webApp.use('/auth', createAuthRouter({ express, db: database }));
  attachWebSocketServer(httpServer, database);

  webApp.use((error, _req, res, nextMiddleware) => {
    if (res.headersSent) {
      nextMiddleware(error);
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
}
