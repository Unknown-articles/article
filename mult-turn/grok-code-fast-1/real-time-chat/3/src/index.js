import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';

const myApp = express();
const MY_PORT = process.env.PORT || 3000;
const MY_FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
const MY_DB_PATH = process.env.DB_PATH || './chat.db';
const MY_JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

const myDb = new sqlite3.Database(MY_DB_PATH);

// Initialize database tables
myDb.serialize(() => {
  myDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL,
      username  TEXT NOT NULL,
      content   TEXT NOT NULL,
      timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
});

// Auth middleware
const checkToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  jwt.verify(token, MY_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  });
};

myApp.use(cors({ origin: MY_FRONTEND_ORIGIN, credentials: true }));
myApp.use(express.json());

myApp.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

myApp.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  myDb.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      myDb.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        const userId = this.lastID;
        const token = jwt.sign({ userId, username }, MY_JWT_SECRET);
        res.status(201).json({ token, userId, username });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

myApp.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  myDb.get('SELECT id, password FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
      const isValid = await bcrypt.compare(password, row.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ userId: row.id, username }, MY_JWT_SECRET);
      res.json({ token, userId: row.id, username });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

const serverInstance = myApp.listen(MY_PORT, () => {
  console.log(`Server running on port ${MY_PORT}`);
});

// WebSocket server
const myWss = new WebSocketServer({ server: serverInstance });
const myClients = new Set();

myWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${MY_PORT}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001);
    return;
  }

  jwt.verify(token, MY_JWT_SECRET, (err, user) => {
    if (err) {
      ws.close(4002);
      return;
    }

    ws.user = user;
    myClients.add(ws);

    // Send message history
    myDb.all('SELECT id, user_id AS userId, username, content, timestamp FROM messages ORDER BY id ASC LIMIT 50', (err, rows) => {
      if (err) {
        console.error('Error fetching history:', err);
        return;
      }
      ws.send(JSON.stringify({ type: 'history', messages: rows }));
    });

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (msg.type !== 'message' || !msg.content || typeof msg.content !== 'string' || msg.content.trim() === '') {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }

      // Insert message
      myDb.run('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)', [ws.user.userId, ws.user.username, msg.content.trim()], function(err) {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
          return;
        }

        const messageId = this.lastID;

        // Get the saved message
        myDb.get('SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?', [messageId], (err, row) => {
          if (err) {
            console.error('Error retrieving message:', err);
            return;
          }

          // Broadcast to all clients
          const broadcastMsg = { type: 'message', ...row };
          myClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(broadcastMsg));
            }
          });
        });
      });
    });

    ws.on('close', () => {
      myClients.delete(ws);
    });
  });
});