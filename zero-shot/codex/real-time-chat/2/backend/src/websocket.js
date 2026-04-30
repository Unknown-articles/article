import WebSocket, { WebSocketServer } from 'ws';
import { createMessage, getMessageHistory } from './db.js';
import { verifyToken } from './auth.js';

const CLOSE_AUTH_REQUIRED = 4001;
const CLOSE_INVALID_TOKEN = 4002;
const MAX_MESSAGE_LENGTH = 2000;

function parseToken(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('token');
}

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function broadcast(clients, payload) {
  const encodedPayload = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encodedPayload);
    }
  }
}

function handleClientMessage(ws, wss, user, rawMessage) {
  let payload;

  try {
    payload = JSON.parse(rawMessage.toString());
  } catch {
    sendJson(ws, { type: 'error', message: 'Invalid JSON payload' });
    return;
  }

  if (payload?.type !== 'message') {
    sendJson(ws, { type: 'error', message: 'Unsupported message type' });
    return;
  }

  const content = typeof payload.content === 'string' ? payload.content.trim() : '';

  if (!content) {
    sendJson(ws, { type: 'error', message: 'Message content is required' });
    return;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    sendJson(ws, { type: 'error', message: 'Message content is too long' });
    return;
  }

  const message = createMessage(user, content);
  broadcast(wss.clients, { type: 'message', ...message });
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const token = parseToken(req);

    if (!token) {
      ws.close(CLOSE_AUTH_REQUIRED, 'authentication required');
      return;
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      ws.close(CLOSE_INVALID_TOKEN, 'invalid or expired token');
      return;
    }

    ws.user = user;
    sendJson(ws, { type: 'history', messages: getMessageHistory() });

    ws.on('message', (rawMessage) => {
      handleClientMessage(ws, wss, user, rawMessage);
    });

    ws.on('error', () => {
      ws.close();
    });
  });

  return wss;
}
