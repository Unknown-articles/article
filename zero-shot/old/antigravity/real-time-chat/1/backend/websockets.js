import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import db from './db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

export function initializeWebSockets(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    // Expected basic url: /?token=XYZ
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ws.user = decoded; // { userId, username, ... }
    } catch (err) {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Send previous messages upon connection
    db.all('SELECT * FROM messages ORDER BY timestamp ASC LIMIT 50', [], (err, rows) => {
      if (!err && rows) {
        ws.send(JSON.stringify({ type: 'history', data: rows }));
      }
    });

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        
        if (parsed.type === 'chat_message') {
          const content = parsed.content;
          if (!content) return;

          // First, save to database
          db.run(
            'INSERT INTO messages (userId, username, content) VALUES (?, ?, ?)',
            [ws.user.userId, ws.user.username, content],
            function (err) {
              if (err) {
                console.error('Error saving message', err);
                return;
              }

              const newMessage = {
                id: this.lastID,
                userId: ws.user.userId,
                username: ws.user.username,
                content: content,
                timestamp: new Date().toISOString()
              };

              // Broadcast to all connected clients
              const broadcastData = JSON.stringify({ type: 'new_message', data: newMessage });
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastData);
                }
              });
            }
          );
        }
      } catch (e) {
        console.error('Message parsing error', e);
      }
    });
    
    ws.on('error', console.error);
  });
  
  return wss;
}
