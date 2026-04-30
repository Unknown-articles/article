import express from 'express';
import cors from 'cors';
import http from 'http';
import { initDb } from './db.js';
import authRouter from './auth.js';
import { setupWebSocket } from './websocket.js';

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

app.use(express.json());

app.use('/auth', authRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

setupWebSocket(server);

async function start() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
