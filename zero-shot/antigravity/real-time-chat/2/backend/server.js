import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import db from './db.js';
import authRouter from './auth.js';
import { initWebSocketServer } from './websocket.js';

const app = express();
const server = createServer(app);

initWebSocketServer(server);

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
