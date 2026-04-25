import { WebSocketServer } from 'ws';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import db from './db.js';

export const activeConnections = new Map();

const fetchHistory = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp
   FROM messages ORDER BY id DESC LIMIT 50`
);

const saveMessage = db.prepare(
  `INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)`
);

const findMessage = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?`
);

function sendToSocket(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcastAll(payload) {
  const frame = JSON.stringify(payload);
  for (const ws of activeConnections.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(frame);
  }
}

export function initWebSocket(server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url, 'ws://localhost');
    const token = searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let connectedUser;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
      connectedUser = { userId: payload.userId, username: payload.username };
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.user = connectedUser;
    activeConnections.set(ws, connectedUser);
    console.log(`WS connected: ${connectedUser.username} (userId=${connectedUser.userId}), total=${activeConnections.size}`);

    const recentMessages = fetchHistory.all().reverse();
    sendToSocket(ws, { type: 'history', messages: recentMessages });

    ws.on('message', (rawData) => {
      let parsedData;
      try {
        parsedData = JSON.parse(rawData.toString());
      } catch {
        sendToSocket(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      if (parsedData.type !== 'message') {
        sendToSocket(ws, { type: 'error', message: 'Unknown message type' });
        return;
      }

      const msgContent = typeof parsedData.content === 'string' ? parsedData.content.trim() : '';
      if (!msgContent) {
        sendToSocket(ws, { type: 'error', message: 'content must be a non-empty string' });
        return;
      }

      const { lastInsertRowid } = saveMessage.run(connectedUser.userId, connectedUser.username, msgContent);
      const storedMessage = findMessage.get(lastInsertRowid);

      broadcastAll({ type: 'message', ...storedMessage });
    });

    ws.on('close', () => {
      activeConnections.delete(ws);
      console.log(`WS disconnected: ${connectedUser.username}, total=${activeConnections.size}`);
    });
  });

  return wsServer;
}
