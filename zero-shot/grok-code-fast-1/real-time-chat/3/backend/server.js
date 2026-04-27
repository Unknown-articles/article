import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const DB_PATH = process.env.DB_PATH || './chat.db';
const JWT_SECRET = process.env.JWT_SECRET || 'secret'; // Use a strong secret in production

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// Database setup
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Username already taken' });
        }
        return res.status(500).json({ error: 'Internal server error' });
      }
      const token = jwt.sign({ userId: this.lastID, username }, JWT_SECRET);
      res.status(201).json({ token, userId: this.lastID, username });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, userId: user.id, username: user.username });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket handling
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    ws.user = decoded;
    // Send history
    db.all('SELECT id, user_id as userId, username, content, timestamp FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to load history' }));
        return;
      }
      ws.send(JSON.stringify({ type: 'history', messages: rows }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'message') {
          const { content } = message;
          if (!content || content.trim() === '') return;
          const timestamp = new Date().toISOString();
          db.run('INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)', [ws.user.userId, ws.user.username, content, timestamp], function(err) {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
              return;
            }
            const msg = { type: 'message', id: this.lastID, userId: ws.user.userId, username: ws.user.username, content, timestamp };
            // Broadcast to all
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(msg));
              }
            });
          });
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      // Handle disconnection if needed
    });

  } catch (error) {
    ws.close(4002, 'Invalid or expired token');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});