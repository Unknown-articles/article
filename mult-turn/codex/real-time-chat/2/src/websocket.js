import { WebSocketServer } from 'ws';
import { verifyAuthToken } from './auth.js';

export const liveClients = new Set();

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
    db.run(sql, params, function finishStatement(error) {
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

function mapMessageRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    timestamp: row.timestamp
  };
}

async function getMessageHistory(db) {
  const recentRows = await all(
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

  return recentRows.map(mapMessageRecord);
}

async function persistMessage(db, activeUser, content) {
  const insertResult = await run(
    db,
    `INSERT INTO messages (user_id, username, content)
     VALUES (?, ?, ?)`,
    [activeUser.userId, activeUser.username, content]
  );
  const insertedRow = await get(
    db,
    `SELECT id, user_id, username, content, timestamp
     FROM messages
     WHERE id = ?`,
    [insertResult.lastID]
  );

  return mapMessageRecord(insertedRow);
}

function pushJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function pushError(socket, message) {
  pushJson(socket, { type: 'error', message });
}

function readIncomingMessage(rawMessage) {
  let clientPayload;

  try {
    clientPayload = JSON.parse(rawMessage.toString());
  } catch {
    return { error: 'Invalid JSON received from client' };
  }

  if (!clientPayload || clientPayload.type !== 'message') {
    return { error: 'Malformed message payload' };
  }

  if (
    typeof clientPayload.content !== 'string' ||
    clientPayload.content.trim().length === 0
  ) {
    return { error: 'Missing or empty content field' };
  }

  return { content: clientPayload.content };
}

function publishMessage(message) {
  for (const client of liveClients) {
    if (client.readyState === client.OPEN) {
      pushJson(client, { type: 'message', ...message });
    }
  }
}

export function attachWebSocketServer(server, db) {
  const socketHub = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const token = requestUrl.searchParams.get('token');

    if (!token) {
      socketHub.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, 'Authentication required');
      });
      return;
    }

    let user;

    try {
      user = verifyAuthToken(token);
    } catch {
      socketHub.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4002, 'Invalid or expired token');
      });
      return;
    }

    socketHub.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      socketHub.emit('connection', ws, request);
    });
  });

  socketHub.on('connection', async (ws) => {
    liveClients.add(ws);

    ws.on('close', () => {
      liveClients.delete(ws);
    });

    ws.on('message', async (rawMessage) => {
      const parsedMessage = readIncomingMessage(rawMessage);

      if (parsedMessage.error) {
        pushError(ws, parsedMessage.error);
        return;
      }

      try {
        const storedMessage = await persistMessage(db, ws.user, parsedMessage.content);
        publishMessage(storedMessage);
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
        pushError(ws, 'Failed to save message');
      }
    });

    try {
      const messageHistory = await getMessageHistory(db);
      pushJson(ws, { type: 'history', messages: messageHistory });
    } catch (error) {
      console.error('Failed to load message history:', error);
      pushError(ws, 'Failed to load message history');
    }
  });

  return socketHub;
}
