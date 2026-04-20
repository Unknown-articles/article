import { WebSocketServer } from 'ws';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import db from './db.js';

export const clients = new Map();

const getHistory = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp
   FROM messages ORDER BY id DESC LIMIT 50`
);

const insertMessage = db.prepare(
  `INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)`
);

const getMessageById = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?`
);

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload) {
  const frame = JSON.stringify(payload);
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(frame);
  }
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url, 'ws://localhost');
    const token = searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
      user = { userId: payload.userId, username: payload.username };
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.user = user;
    clients.set(ws, user);
    console.log(`WS connected: ${user.username} (userId=${user.userId}), total=${clients.size}`);

    const history = getHistory.all().reverse();
    send(ws, { type: 'history', messages: history });

    ws.on('message', (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      if (parsed.type !== 'message') {
        send(ws, { type: 'error', message: 'Unknown message type' });
        return;
      }

      const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
      if (!content) {
        send(ws, { type: 'error', message: 'content must be a non-empty string' });
        return;
      }

      const { lastInsertRowid } = insertMessage.run(user.userId, user.username, content);
      const saved = getMessageById.get(lastInsertRowid);

      broadcast({ type: 'message', ...saved });
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`WS disconnected: ${user.username}, total=${clients.size}`);
    });
  });

  return wss;
}
