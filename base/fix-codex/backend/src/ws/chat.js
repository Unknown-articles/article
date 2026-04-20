import { createItem, getItems } from '../db/jsonDb.js';
import { getUserByAccessToken } from '../services/tokenService.js';

const clients = new Map();

export function setupChatWs(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const user = getUserByAccessToken(url.searchParams.get('token'));

    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      ws.close(1008, 'Unauthorized');
      return;
    }

    clients.set(ws, { userId: user.id, username: user.username });

    getItems('messages', { _sort: 'createdAt', _order: 'desc', _limit: '50' }).then(messages => {
      ws.send(JSON.stringify({ type: 'history', messages: messages.reverse() }));
    });

    broadcast({
      type: 'system',
      message: `${user.username} joined`,
      timestamp: new Date().toISOString(),
    });

    ws.on('message', async raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'message' && typeof data.content === 'string' && data.content.trim()) {
          const message = await createItem('messages', {
            userId: user.id,
            username: user.username,
            content: data.content.trim(),
          });
          broadcast({ type: 'message', ...message });
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid_message' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcast({
        type: 'system',
        message: `${user.username} left`,
        timestamp: new Date().toISOString(),
      });
    });

    ws.on('error', () => clients.delete(ws));
  });
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}
