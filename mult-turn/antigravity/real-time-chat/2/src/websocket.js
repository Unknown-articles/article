import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'supersecretkey';
export const connectedClients = new Set();

export function initializeSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    jwt.verify(token, TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        ws.close(4002, 'Invalid or expired token');
        return;
      }

      ws.currentUser = decoded;
      connectedClients.add(ws);

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
        let messagePayload;
        try {
          messagePayload = JSON.parse(data.toString());
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON received from a client' }));
          return;
        }

        if (messagePayload.type !== 'message' || !messagePayload.content || typeof messagePayload.content !== 'string' || !messagePayload.content.trim()) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing or empty content field in the message' }));
          return;
        }

        try {
          // Save to database BEFORE broadcasting
          const result = await db.run(
            'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
            ws.currentUser.userId,
            ws.currentUser.username,
            messagePayload.content
          );

          // Read back the saved row to get database-assigned id and timestamp
          const row = await db.get(
            'SELECT id, user_id as userId, username, content, timestamp FROM messages WHERE id = ?',
            result.lastID
          );

          // Broadcast to ALL authenticated isOnline connectedClients (including sender)
          const messageStr = JSON.stringify({
            type: 'message',
            id: row.id,
            userId: row.userId,
            username: row.username,
            content: row.content,
            timestamp: row.timestamp
          });

          for (const client of connectedClients) {
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
        connectedClients.delete(ws);
      });
    });
  });

  return wss;
}

