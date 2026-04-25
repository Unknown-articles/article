import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRouter from './routes/auth.js';
import { setupWebSocketServer } from './websocket/wsServer.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const server = createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
