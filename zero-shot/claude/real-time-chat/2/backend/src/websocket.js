import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { verifyToken } from './auth.js';
import db from './db.js';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://localhost`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.userId = user.userId;
    ws.username = user.username;

    // Send message history
    const history = db.prepare('SELECT * FROM messages ORDER BY id ASC LIMIT 100').all();
    ws.send(JSON.stringify({ type: 'history', messages: history.map(formatMessage) }));

    ws.on('message', (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (parsed.type !== 'message' || !parsed.content?.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }

      const stmt = db.prepare(
        'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)'
      );
      const result = stmt.run(ws.userId, ws.username, parsed.content.trim());
      const saved = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      const msg = formatMessage(saved);

      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: 'message', ...msg }));
        }
      });
    });
  });
}

function formatMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    timestamp: row.timestamp,
  };
}
