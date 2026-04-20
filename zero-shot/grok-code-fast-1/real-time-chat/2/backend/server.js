import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerUser, loginUser } from './auth.js';
import { setupWebSocket } from './websocket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await registerUser(username, password);
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'Username already taken') {
      res.status(409).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await loginUser(username, password);
    res.status(200).json(result);
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      res.status(401).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Setup WebSocket
setupWebSocket(server);