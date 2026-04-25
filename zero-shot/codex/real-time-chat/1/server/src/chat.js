import WebSocket, { WebSocketServer } from "ws";
import { verifyToken } from "./auth.js";
import { all, get, run } from "./db.js";

const CLOSE_AUTH_REQUIRED = 4001;
const CLOSE_INVALID_TOKEN = 4002;

function sendJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function normalizeMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    timestamp: row.timestamp,
  };
}

async function loadHistory() {
  const rows = await all(
    `SELECT id, user_id, username, content, timestamp
     FROM messages
     ORDER BY id ASC`,
  );

  return rows.map(normalizeMessage);
}

async function resolveAuthenticatedUser(token) {
  const payload = verifyToken(token);
  const user = await get("SELECT id, username FROM users WHERE id = ?", [
    payload.userId,
  ]);

  if (!user || user.username !== payload.username) {
    throw new Error("Invalid token");
  }

  return {
    userId: user.id,
    username: user.username,
  };
}

async function persistMessage(user, content) {
  const timestamp = new Date().toISOString();
  const result = await run(
    "INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)",
    [user.userId, user.username, content, timestamp],
  );

  return {
    id: result.lastID,
    userId: user.userId,
    username: user.username,
    content,
    timestamp,
  };
}

export function attachChatServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (socket, request) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const token = requestUrl.searchParams.get("token");

    if (!token) {
      socket.close(CLOSE_AUTH_REQUIRED, "Authentication required");
      return;
    }

    try {
      const user = await resolveAuthenticatedUser(token);
      socket.user = user;

      const history = await loadHistory();
      sendJson(socket, { type: "history", messages: history });
    } catch (_error) {
      socket.close(CLOSE_INVALID_TOKEN, "Invalid or expired token");
      return;
    }

    socket.on("message", async (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString());

        if (payload?.type !== "message") {
          sendJson(socket, { type: "error", message: "Unsupported message type" });
          return;
        }

        const content = payload.content?.trim();

        if (!content) {
          sendJson(socket, { type: "error", message: "Message content is required" });
          return;
        }

        const message = await persistMessage(socket.user, content);
        const serializedMessage = JSON.stringify({ type: "message", ...message });

        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(serializedMessage);
          }
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          sendJson(socket, { type: "error", message: "Invalid message payload" });
          return;
        }

        console.error("Failed to process WebSocket message", error);
        sendJson(socket, { type: "error", message: "Failed to send message" });
      }
    });

    socket.on("close", () => {
      console.log(`Client disconnected: ${socket.user?.username ?? "unknown"}`);
    });
  });

  return wss;
}
