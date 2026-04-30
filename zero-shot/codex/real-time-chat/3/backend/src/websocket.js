import { WebSocket, WebSocketServer } from 'ws';
import { findUserById, verifyToken } from './auth.js';
import { createMessage, listRecentMessages } from './messages.js';

const CLOSE_AUTH_REQUIRED = 4001;
const CLOSE_INVALID_TOKEN = 4002;

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function broadcast(clients, payload) {
  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getTokenFromRequest(req) {
  const url = new URL(req.url, 'ws://localhost');
  return url.searchParams.get('token');
}

function authenticateConnection(req) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return { errorCode: CLOSE_AUTH_REQUIRED, reason: 'authentication required' };
  }

  try {
    const payload = verifyToken(token);
    const user = findUserById(payload.userId);

    if (!user || user.username !== payload.username) {
      return { errorCode: CLOSE_INVALID_TOKEN, reason: 'invalid or expired token' };
    }

    return { user };
  } catch {
    return { errorCode: CLOSE_INVALID_TOKEN, reason: 'invalid or expired token' };
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const auth = authenticateConnection(req);

    if (auth.errorCode) {
      ws.close(auth.errorCode, auth.reason);
      return;
    }

    ws.user = auth.user;
    sendJson(ws, { type: 'history', messages: listRecentMessages() });

    ws.on('message', (rawMessage) => {
      let payload;

      try {
        payload = JSON.parse(rawMessage.toString());
      } catch {
        sendJson(ws, { type: 'error', message: 'Invalid message format' });
        return;
      }

      if (payload.type !== 'message' || typeof payload.content !== 'string') {
        sendJson(ws, { type: 'error', message: 'Unsupported message type' });
        return;
      }

      const content = payload.content.trim();

      if (!content) {
        sendJson(ws, { type: 'error', message: 'Message content is required' });
        return;
      }

      const savedMessage = createMessage({
        userId: ws.user.id,
        username: ws.user.username,
        content,
      });

      broadcast(wss.clients, { type: 'message', ...savedMessage });
    });

    ws.on('error', () => {
      ws.close();
    });
  });

  return wss;
}
