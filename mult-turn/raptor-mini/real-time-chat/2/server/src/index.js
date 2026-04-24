import http from "http";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import { setupDatabase, fetchOne, fetchAll, executeSql } from "./db.js";
import { signToken, decodeToken } from "./auth.js";

const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const SALT_ROUNDS = 10;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const activeConnections = new Set();

wss.on("connection", async (ws) => {
  ws.on("close", () => {
    activeConnections.delete(ws);
  });

  ws.on("message", async (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (!payload || payload.type !== "message") {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message payload" }));
      return;
    }

    const content = payload.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      ws.send(JSON.stringify({ type: "error", message: "content is required" }));
      return;
    }

    try {
      const insertResult = await executeSql(
        "INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)",
        [ws.user.userId, ws.user.username, content]
      );

      const savedMessage = await fetchOne(
        "SELECT id, user_id AS userId, username, content, timestamp FROM messages WHERE id = ?",
        [insertResult.lastID]
      );

      const messagePayload = {
        type: "message",
        ...savedMessage,
      };

      for (const client of activeConnections) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(messagePayload));
        }
      }
    } catch (error) {
      console.error(error);
      ws.send(JSON.stringify({ type: "error", message: "Unable to send message" }));
    }
  });

  const historyMessages = await fetchAll(
    `SELECT id, user_id AS userId, username, content, timestamp
     FROM (SELECT id, user_id, username, content, timestamp
           FROM messages
           ORDER BY id DESC
           LIMIT 50)
     ORDER BY id ASC`
  );

  ws.send(
    JSON.stringify({
      type: "history",
      messages: historyMessages,
    })
  );
});

server.on("upgrade", (request, socket, head) => {
  const host = request.headers.host || `localhost:${PORT}`;
  const url = new URL(request.url, `http://${host}`);
  const token = url.searchParams.get("token");

  const rejectConnection = (code) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.close(code);
    });
  };

  if (!token) {
    return rejectConnection(4001);
  }

  let decoded;
  try {
    decoded = decodeToken(token);
  } catch (error) {
    return rejectConnection(4002);
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.user = {
      userId: decoded.userId,
      username: decoded.username,
    };
    activeConnections.add(ws);
    wss.emit("connection", ws, request);
  });
});

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.type("application/json");
    return originalJson(body);
  };
  next();
});

function sendErrorResponse(res, message, status = 400) {
  return res.status(status).json({ error: message });
}

app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || typeof username !== "string") {
    return sendErrorResponse(res, "username is required", 400);
  }

  if (username.length < 3) {
    return sendErrorResponse(res, "username must be at least 3 characters", 400);
  }

  if (!password || typeof password !== "string") {
    return sendErrorResponse(res, "password is required", 400);
  }

  if (password.length < 6) {
    return sendErrorResponse(res, "password must be at least 6 characters", 400);
  }

  try {
    const existingUser = await fetchOne(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser) {
      return sendErrorResponse(res, "Username already taken", 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const insertResult = await executeSql(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    const userId = insertResult.lastID;
    const token = signToken({ userId, username });

    return res.status(201).json({
      token,
      userId,
      username,
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("UNIQUE") || message.includes("already taken")) {
      return sendErrorResponse(res, "Username already taken", 409);
    }

    console.error(error);
    return sendErrorResponse(res, "Internal server error", 500);
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || typeof username !== "string") {
    return sendErrorResponse(res, "username is required", 400);
  }

  if (!password || typeof password !== "string") {
    return sendErrorResponse(res, "password is required", 400);
  }

  try {
    const user = await fetchOne(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      return sendErrorResponse(res, "Invalid credentials", 401);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return sendErrorResponse(res, "Invalid credentials", 401);
    }

    const token = signToken({ userId: user.id, username: user.username });

    return res.status(200).json({
      token,
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error(error);
    return sendErrorResponse(res, "Internal server error", 500);
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

async function launchServer() {
  try {
    await setupDatabase();
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

launchServer();
