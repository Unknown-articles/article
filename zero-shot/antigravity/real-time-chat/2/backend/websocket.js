import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { parse } from 'url';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

export function initWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, request) => {
    const { query } = parse(request.url, true);
    const token = query.token;

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        ws.close(4002, 'Invalid or expired token');
        return;
      }

      const user = decoded;

      // Send message history immediately
      db.all('SELECT * FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to load history' }));
          return;
        }

        const messages = rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          username: row.username,
          content: row.content,
          timestamp: row.timestamp
        }));

        ws.send(JSON.stringify({ type: 'history', messages }));
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'message' && parsed.content) {
            const timestamp = new Date().toISOString();
            
            db.run(
              'INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)',
              [user.userId, user.username, parsed.content, timestamp],
              function(err) {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
                  return;
                }

                const broadcastMsg = {
                  type: 'message',
                  id: this.lastID,
                  userId: user.userId,
                  username: user.username,
                  content: parsed.content,
                  timestamp
                };

                const msgString = JSON.stringify(broadcastMsg);

                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(msgString);
                  }
                });
              }
            );
          }
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });
    });
  });
}
