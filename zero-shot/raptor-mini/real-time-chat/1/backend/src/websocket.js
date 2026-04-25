import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import db from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_this_secret";

function createWebSocketServer(server) {
  const wss = new WebSocketServer({ server });
  const clients = new Set();

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, `ws://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      ws.close(4002, "Invalid or expired token");
      return;
    }

    ws.user = {
      userId: payload.userId,
      username: payload.username,
    };

    clients.add(ws);

    try {
      const messages = await db.all(
        "SELECT id, user_id AS userId, username, content, timestamp FROM messages ORDER BY id ASC"
      );
      ws.send(JSON.stringify({ type: "history", messages }));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: "Unable to load message history" }));
    }

    ws.on("message", async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        if (raw.type !== "message" || typeof raw.content !== "string") {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
          return;
        }

        const content = raw.content.trim();
        if (!content) {
          ws.send(JSON.stringify({ type: "error", message: "Message content cannot be empty" }));
          return;
        }

        const result = await db.run(
          "INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)",
          ws.user.userId,
          ws.user.username,
          content
        );

        const message = await db.get(
          "SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?",
          result.lastID
        );

        const payloadMessage = { type: "message", ...message };
        const encoded = JSON.stringify(payloadMessage);

        for (const client of clients) {
          if (client.readyState === client.OPEN) {
            client.send(encoded);
          }
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", message: "Unable to process message" }));
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });
}

export default createWebSocketServer;
