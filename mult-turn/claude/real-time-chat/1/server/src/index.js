import http from 'http';
import express from 'express';
import cors from 'cors';
import './db.js';
import authRouter from './routes/auth.js';
import { attachWebSocket } from './ws.js';

const PORT = process.env.PORT ?? 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);

const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS origin: ${FRONTEND_ORIGIN}`);
});
