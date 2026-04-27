import { WebSocketServer, WebSocket } from 'ws';
import { initDB } from './db.js';
import { verifyToken } from './auth.js';

const clients = new Map();

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    clients.set(ws, user);

    // Send message history
    const db = await initDB();
    const messages = await db.all('SELECT id, user_id as userId, username, content, timestamp FROM messages ORDER BY timestamp ASC');
    ws.send(JSON.stringify({ type: 'history', messages }));

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'message') {
          const db = await initDB();
          const result = await db.run(
            'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
            [user.userId, user.username, message.content]
          );
          const savedMessage = await db.get(
            'SELECT id, user_id as userId, username, content, timestamp FROM messages WHERE id = ?',
            [result.lastID]
          );

          // Broadcast to all clients
          const broadcastMessage = { type: 'message', ...savedMessage };
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(broadcastMessage));
            }
          });
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });
}