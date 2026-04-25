import { WebSocketServer } from 'ws';
import { verifyToken } from '../middleware/auth.js';
import db from '../db/database.js';

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_LIMIT      = 50;

export function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  // Map<WebSocket, { userId: number, username: string }>
  const clients = new Map();

  wss.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const token = searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    clients.set(ws, { userId: user.userId, username: user.username });
    console.log(`[WS] ${user.username} connected (${clients.size} online)`);

    // Send message history to the newly connected client
    const history = db
      .prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?')
      .all(HISTORY_LIMIT)
      .reverse();

    ws.send(JSON.stringify({
      type: 'history',
      messages: history.map(normalizeMessage),
    }));

    ws.on('message', (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (parsed.type === 'message') {
        handleChatMessage(ws, parsed, clients);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] ${clients.get(ws)?.username ?? 'unknown'} disconnected`);
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err.message);
      clients.delete(ws);
    });
  });

  return wss;
}

function handleChatMessage(ws, parsed, clients) {
  const client = clients.get(ws);
  if (!client) return;

  const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';

  if (!content) {
    ws.send(JSON.stringify({ type: 'error', message: 'Message cannot be empty' }));
    return;
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    ws.send(JSON.stringify({ type: 'error', message: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` }));
    return;
  }

  // Persist before broadcasting — use explicit ISO 8601 timestamp
  const timestamp = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)')
    .run(client.userId, client.username, content, timestamp);

  const saved = db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(Number(result.lastInsertRowid));

  const payload = JSON.stringify({ type: 'message', ...normalizeMessage(saved) });

  for (const [clientWs] of clients) {
    if (clientWs.readyState === 1 /* OPEN */) {
      clientWs.send(payload);
    }
  }
}

function normalizeMessage(msg) {
  return {
    id:        Number(msg.id),
    userId:    Number(msg.user_id),
    username:  msg.username,
    content:   msg.content,
    timestamp: msg.timestamp,
  };
}
