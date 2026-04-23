import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
export const clients = new Set();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        ws.close(4002, 'Invalid or expired token');
        return;
      }

      ws.user = decoded;
      clients.add(ws);

      const db = getDb();

      // 1. Send History (Last 50 messages, ordered oldest first)
      try {
        const rows = await db.all(
          `SELECT id, user_id as userId, username, content, timestamp 
           FROM messages 
           ORDER BY id DESC 
           LIMIT 50`
        );
        const messages = rows.reverse();
        ws.send(JSON.stringify({ type: 'history', messages }));
      } catch (err) {
        console.error('Failed to load history', err);
      }

      // 2. Handle incoming messages
      ws.on('message', async (data) => {
        let payload;
        try {
          payload = JSON.parse(data.toString());
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON received from a client' }));
          return;
        }

        if (payload.type !== 'message' || !payload.content || typeof payload.content !== 'string' || !payload.content.trim()) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing or empty content field in the message' }));
          return;
        }

        try {
          // Save to database BEFORE broadcasting
          const result = await db.run(
            'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
            ws.user.userId,
            ws.user.username,
            payload.content
          );

          // Read back the saved row to get database-assigned id and timestamp
          const row = await db.get(
            'SELECT id, user_id as userId, username, content, timestamp FROM messages WHERE id = ?',
            result.lastID
          );

          // Broadcast to ALL authenticated connected clients (including sender)
          const messageStr = JSON.stringify({
            type: 'message',
            id: row.id,
            userId: row.userId,
            username: row.username,
            content: row.content,
            timestamp: row.timestamp
          });

          for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(messageStr);
            }
          }
        } catch (err) {
          console.error('Failed to save or broadcast message', err);
        }
      });

      // Clean up on disconnect
      ws.on('close', () => {
        clients.delete(ws);
      });
    });
  });

  return wss;
}
