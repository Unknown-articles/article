import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRouter from './auth.js';
import { setupWebSocket } from './websocket.js';
import { PORT, FRONTEND_ORIGIN } from './config.js';

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
