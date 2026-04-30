import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const PORT = Number(process.env.PORT || 5000);
const DB_PATH = process.env.DB_PATH || './chat.db';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5273'];
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim())
  : defaultOrigins;

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || FRONTEND_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
`);
await db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
`);

function sendJsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function generateToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
}

async function getUserByUsername(username) {
  return db.get('SELECT id, username, password FROM users WHERE username = ?', username);
}

async function createUser(username, password) {
  const hashed = await bcrypt.hash(password, 8);
  const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', username, hashed);
  return { id: result.lastID, username };
}

async function createMessage(userId, username, content) {
  const result = await db.run('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)', userId, username, content);
  return db.get('SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?', result.lastID);
}

async function getMessageHistory() {
  return db.all('SELECT id, user_id AS userId, username, content, timestamp FROM messages ORDER BY id ASC');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return sendJsonError(res, 400, 'Username must be at least 3 characters');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendJsonError(res, 400, 'Password must be at least 6 characters');
  }

  const existing = await getUserByUsername(username.trim());
  if (existing) {
    return sendJsonError(res, 409, 'Username already taken');
  }

  const user = await createUser(username.trim(), password);
  const token = generateToken(user);
  res.status(201).json({ token, userId: user.id, username: user.username });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return sendJsonError(res, 400, 'Username must be at least 3 characters');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendJsonError(res, 400, 'Password must be at least 6 characters');
  }

  const user = await getUserByUsername(username.trim());
  if (!user) {
    return sendJsonError(res, 401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return sendJsonError(res, 401, 'Invalid credentials');
  }

  const token = generateToken(user);
  res.json({ token, userId: user.id, username: user.username });
});

const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

function parseToken(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

function broadcastMessage(message) {
  const payload = JSON.stringify({ type: 'message', ...message });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', async (ws, req) => {
  const token = parseToken(req);
  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    ws.close(4002, 'Invalid or expired token');
    return;
  }

  ws.user = { userId: decoded.userId, username: decoded.username };

  try {
    const history = await getMessageHistory();
    ws.send(JSON.stringify({ type: 'history', messages: history }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to load message history' }));
  }

  ws.on('message', async (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    if (event.type !== 'message' || typeof event.content !== 'string' || !event.content.trim()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message payload' }));
      return;
    }

    try {
      const message = await createMessage(ws.user.userId, ws.user.username, event.content.trim());
      broadcastMessage(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Unable to save message' }));
    }
  });
});
