import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import authRouter from './routes/auth.js';
import { setupWebSocket } from './websocket.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// Force Content-Type: application/json for all responses if needed, though res.json does this
app.use((req, res, next) => {
  res.type('application/json');
  next();
});

// Configure CORS
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

app.use(express.json());
app.use('/auth', authRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

let db;

initDb().then((database) => {
  db = database;
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  setupWebSocket(server);
}).catch((err) => {
  console.error('Failed to initialize database', err);
  process.exit(1);
});
