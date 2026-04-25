import { WebSocketServer } from 'ws';
import { verifyToken } from './auth.js';
import { insertMessage, getAllMessages } from './db.js';

const clients = new Map();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    const user = { id: payload.userId, username: payload.username };
    clients.set(ws, user);

    // Send message history
    getAllMessages().then(messages => {
      ws.send(JSON.stringify({ type: 'history', messages }));
    }).catch(err => {
      console.error('Error fetching messages:', err);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'message' && msg.content) {
          const message = {
            id: null, // Will be set after insert
            userId: user.id,
            username: user.username,
            content: msg.content,
            timestamp: new Date().toISOString()
          };

          // Insert into DB
          const result = await insertMessage(user.id, user.username, msg.content);
          message.id = result.lastID;

          // Broadcast to all clients
          const broadcastMsg = JSON.stringify({ type: 'message', ...message });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
    });
  });

  return wss;
}