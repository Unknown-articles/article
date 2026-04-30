import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './auth.js';
import { URL } from 'url';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Authentication required');
        return;
      }

      let user;
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        ws.close(4002, 'Invalid or expired token');
        return;
      }

      ws.user = user;

      // Send history immediately
      try {
        const history = await db.all('SELECT id, user_id AS userId, username, content, timestamp FROM messages ORDER BY id ASC');
        ws.send(JSON.stringify({ type: 'history', messages: history }));
      } catch (err) {
        console.error('Error fetching history:', err);
      }

      ws.on('message', async (messageBuffer) => {
        try {
          const data = JSON.parse(messageBuffer.toString());

          if (data.type === 'message' && data.content) {
            // Save to DB
            const result = await db.run(
              'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
              [ws.user.userId, ws.user.username, data.content]
            );

            // Fetch the inserted message to get the exact timestamp
            const savedMsg = await db.get(
              'SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?',
              [result.id]
            );

            const broadcastData = JSON.stringify({
              type: 'message',
              id: savedMsg.id,
              userId: savedMsg.userId,
              username: savedMsg.username,
              content: savedMsg.content,
              timestamp: savedMsg.timestamp
            });

            wss.clients.forEach((client) => {
              if (client.readyState === 1) { // OPEN
                client.send(broadcastData);
              }
            });
          }
        } catch (err) {
          console.error('Message handling error:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Internal server error processing message' }));
        }
      });
    } catch (err) {
      console.error('Connection error:', err);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}
