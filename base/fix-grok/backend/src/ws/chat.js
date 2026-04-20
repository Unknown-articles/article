import { v4 as uuidv4 } from 'uuid';
import db from '../db/sqliteDb.js';
import { createItem, getItems } from '../db/jsonDb.js';
import { validateToken } from '../middleware/auth.js';

// Connected clients: ws → { userId, username }
const clients = new Map();

export function setupChatWs(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const user = validateToken(token);

    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      ws.close(1008, 'Unauthorized');
      return;
    }

    clients.set(ws, { userId: user.id, username: user.username });

    // Send recent messages (last 50)
    getItems('messages', { _sort: 'createdAt', _order: 'desc', _limit: '50' }).then(msgs => {
      ws.send(JSON.stringify({ type: 'history', messages: msgs.reverse() }));
    });

    // Announce join
    broadcast({ type: 'system', message: `${user.username} joined`, timestamp: new Date().toISOString() }, null);

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'message' && typeof data.content === 'string' && data.content.trim()) {
          const msg = await createItem('messages', {
            userId: user.id,
            username: user.username,
            content: data.content.trim(),
          });
          broadcast({ type: 'message', ...msg }, null);
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid_message' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcast({ type: 'system', message: `${user.username} left`, timestamp: new Date().toISOString() }, null);
    });

    ws.on('error', () => clients.delete(ws));
  });
}

function broadcast(payload, excludeWs) {
  const data = JSON.stringify(payload);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}
