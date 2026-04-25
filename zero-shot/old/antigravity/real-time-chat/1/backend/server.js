import express from 'express';
import cors from 'cors';
import http from 'http';
import db from './db/database.js';
import authRoutes from './routes/auth.js';
import { initializeWebSockets } from './websockets.js';

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
initializeWebSockets(server);

server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
