import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import { initWebSocket } from './websocket.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/auth', authRoutes);

initWebSocket(server);

server.listen(PORT, async () => {
  await initDB();
  console.log(`Server running on port ${PORT}`);
});