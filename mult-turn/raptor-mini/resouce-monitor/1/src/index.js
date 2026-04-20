import http from "http";
import express from "express";
import {
  getCpuSnapshot,
  getMemorySnapshot,
  getDiskSnapshot,
  getUptimeSnapshot,
  getMetricsSnapshot,
  startMetricCollection,
} from "./metrics.js";
import { createWebSocketServer } from "./ws.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const validTypes = new Set(["cpu", "memory", "disk", "uptime"]);

app.use((req, res, next) => {
  res.type("application/json");
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/metrics", (req, res) => {
  const snapshot = getMetricsSnapshot();
  if (!snapshot) {
    return res.status(503).json({ error: "Metrics not yet available" });
  }
  res.status(200).json(snapshot);
});

app.get("/metrics/:type", (req, res) => {
  const { type } = req.params;
  if (!validTypes.has(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }

  let snapshot;
  switch (type) {
    case "cpu":
      snapshot = getCpuSnapshot();
      break;
    case "memory":
      snapshot = getMemorySnapshot();
      break;
    case "disk":
      snapshot = getDiskSnapshot();
      break;
    case "uptime":
      snapshot = getUptimeSnapshot();
      break;
    default:
      snapshot = null;
  }

  if (!snapshot) {
    return res.status(503).json({ error: "Metrics not yet available" });
  }

  res.status(200).json(snapshot);
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

startMetricCollection();

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
