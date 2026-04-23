import { WebSocketServer } from 'ws';
import { verifyAuthToken } from './auth.js';

export const connectedClients = new Set();

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function handleRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function serializeMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    timestamp: row.timestamp
  };
}

async function getMessageHistory(db) {
  const rows = await all(
    db,
    `SELECT id, user_id, username, content, timestamp
     FROM (
       SELECT id, user_id, username, content, timestamp
       FROM messages
       ORDER BY id DESC
       LIMIT 50
     )
     ORDER BY id ASC`
  );

  return rows.map(serializeMessage);
}

async function saveMessage(db, user, content) {
  const result = await run(
    db,
    `INSERT INTO messages (user_id, username, content)
     VALUES (?, ?, ?)`,
    [user.userId, user.username, content]
  );
  const row = await get(
    db,
    `SELECT id, user_id, username, content, timestamp
     FROM messages
     WHERE id = ?`,
    [result.lastID]
  );

  return serializeMessage(row);
}

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function sendError(ws, message) {
  sendJson(ws, { type: 'error', message });
}

function parseClientMessage(rawMessage) {
  let payload;

  try {
    payload = JSON.parse(rawMessage.toString());
  } catch {
    return { error: 'Invalid JSON received from client' };
  }

  if (!payload || payload.type !== 'message') {
    return { error: 'Malformed message payload' };
  }

  if (typeof payload.content !== 'string' || payload.content.trim().length === 0) {
    return { error: 'Missing or empty content field' };
  }

  return { content: payload.content };
}

function broadcastMessage(message) {
  for (const client of connectedClients) {
    if (client.readyState === client.OPEN) {
      sendJson(client, { type: 'message', ...message });
    }
  }
}

export function attachWebSocketServer(server, db) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, 'Authentication required');
      });
      return;
    }

    let user;

    try {
      user = verifyAuthToken(token);
    } catch {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4002, 'Invalid or expired token');
      });
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws) => {
    connectedClients.add(ws);

    ws.on('close', () => {
      connectedClients.delete(ws);
    });

    ws.on('message', async (rawMessage) => {
      const parsedMessage = parseClientMessage(rawMessage);

      if (parsedMessage.error) {
        sendError(ws, parsedMessage.error);
        return;
      }

      try {
        const message = await saveMessage(db, ws.user, parsedMessage.content);
        broadcastMessage(message);
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
        sendError(ws, 'Failed to save message');
      }
    });

    try {
      const messages = await getMessageHistory(db);
      sendJson(ws, { type: 'history', messages });
    } catch (error) {
      console.error('Failed to load message history:', error);
      sendError(ws, 'Failed to load message history');
    }
  });

  return wss;
}
