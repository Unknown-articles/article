import { WebSocketServer } from 'ws';
import { verifyAuthToken } from './auth.js';

export const socketClients = new Set();

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
    db.run(sql, params, function handleDbRun(error) {
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

function toPublicMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    timestamp: row.timestamp
  };
}

async function getMessageHistory(db) {
  const historyRows = await all(
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

  return historyRows.map(toPublicMessage);
}

async function storeMessage(db, user, content) {
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

  return toPublicMessage(row);
}

function sendPacket(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function sendSocketError(ws, message) {
  sendPacket(ws, { type: 'error', message });
}

function decodeClientMessage(rawMessage) {
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

function relayMessage(message) {
  for (const client of socketClients) {
    if (client.readyState === client.OPEN) {
      sendPacket(client, { type: 'message', ...message });
    }
  }
}

export function attachWebSocketServer(server, db) {
  const realtimeGateway = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      realtimeGateway.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, 'Authentication required');
      });
      return;
    }

    let user;

    try {
      user = verifyAuthToken(token);
    } catch {
      realtimeGateway.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4002, 'Invalid or expired token');
      });
      return;
    }

    realtimeGateway.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      realtimeGateway.emit('connection', ws, request);
    });
  });

  realtimeGateway.on('connection', async (ws) => {
    socketClients.add(ws);

    ws.on('close', () => {
      socketClients.delete(ws);
    });

    ws.on('message', async (rawMessage) => {
      const parsedMessage = decodeClientMessage(rawMessage);

      if (parsedMessage.error) {
        sendSocketError(ws, parsedMessage.error);
        return;
      }

      try {
        const message = await storeMessage(db, ws.user, parsedMessage.content);
        relayMessage(message);
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
        sendSocketError(ws, 'Failed to save message');
      }
    });

    try {
      const messages = await getMessageHistory(db);
      sendPacket(ws, { type: 'history', messages });
    } catch (error) {
      console.error('Failed to load message history:', error);
      sendSocketError(ws, 'Failed to load message history');
    }
  });

  return realtimeGateway;
}
