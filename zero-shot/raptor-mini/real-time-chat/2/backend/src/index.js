import express from "express";
import cors from "cors";
import http from "http";
import authRouter from "./auth.js";
import createWebSocketServer from "./websocket.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use("/auth", authRouter);
app.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
