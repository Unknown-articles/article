import { WebSocketServer } from 'ws';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import db from './db.js';

export const socketPool = new Map();

const queryHistory = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp
   FROM messages ORDER BY id DESC LIMIT 50`
);

const insertMsg = db.prepare(
  `INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)`
);

const queryMessage = db.prepare(
  `SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?`
);

function unicast(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function multicast(payload) {
  const frame = JSON.stringify(payload);
  for (const ws of socketPool.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(frame);
  }
}

export function mountWebSocket(server) {
  const socketServer = new WebSocketServer({ server });

  socketServer.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url, 'ws://localhost');
    const token = searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let socketUser;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
      socketUser = { userId: payload.userId, username: payload.username };
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.user = socketUser;
    socketPool.set(ws, socketUser);
    console.log(`WS connected: ${socketUser.username} (userId=${socketUser.userId}), total=${socketPool.size}`);

    const chatHistory = queryHistory.all().reverse();
    unicast(ws, { type: 'history', messages: chatHistory });

    ws.on('message', (rawInput) => {
      let incoming;
      try {
        incoming = JSON.parse(rawInput.toString());
      } catch {
        unicast(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      if (incoming.type !== 'message') {
        unicast(ws, { type: 'error', message: 'Unknown message type' });
        return;
      }

      const textContent = typeof incoming.content === 'string' ? incoming.content.trim() : '';
      if (!textContent) {
        unicast(ws, { type: 'error', message: 'content must be a non-empty string' });
        return;
      }

      const { lastInsertRowid } = insertMsg.run(socketUser.userId, socketUser.username, textContent);
      const persistedMsg = queryMessage.get(lastInsertRowid);

      multicast({ type: 'message', ...persistedMsg });
    });

    ws.on('close', () => {
      socketPool.delete(ws);
      console.log(`WS disconnected: ${socketUser.username}, total=${socketPool.size}`);
    });
  });

  return socketServer;
}
