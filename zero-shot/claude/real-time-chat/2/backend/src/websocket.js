import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './config.js';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.userId = user.userId;
    ws.username = user.username;

    const history = db
      .prepare(
        `SELECT id, user_id AS userId, username, content, timestamp
         FROM messages ORDER BY id ASC LIMIT 100`
      )
      .all();

    ws.send(JSON.stringify({ type: 'history', messages: history }));

    ws.on('message', (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (parsed.type !== 'message' || !parsed.content?.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }

      const content = parsed.content.trim();

      const result = db
        .prepare('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)')
        .run(ws.userId, ws.username, content);

      const saved = db
        .prepare(
          `SELECT id, user_id AS userId, username, content, timestamp
           FROM messages WHERE id = ?`
        )
        .get(result.lastInsertRowid);

      const outgoing = JSON.stringify({
        type: 'message',
        id: saved.id,
        userId: saved.userId,
        username: saved.username,
        content: saved.content,
        timestamp: saved.timestamp,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(outgoing);
        }
      });
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
    });
  });

  return wss;
}
