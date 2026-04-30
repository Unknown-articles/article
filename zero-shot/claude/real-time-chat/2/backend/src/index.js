import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { register, login, generateToken } from './auth.js';
import { setupWebSocket } from './websocket.js';

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5273';

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const user = await register(username, password);
    const token = generateToken(user.userId, user.username);
    res.status(201).json({ token, userId: user.userId, username: user.username });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const user = await login(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken(user.userId, user.username);
  res.json({ token, userId: user.userId, username: user.username });
});

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
