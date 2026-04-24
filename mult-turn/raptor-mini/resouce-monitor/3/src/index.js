import http from "http";
import express from "express";
import {
  getCpuSnapshot,
  getMemorySnapshot,
  getDiskSnapshot,
  getUptimeSnapshot,
  getMetricsSnapshot,
  startStatisticsLoop,
} from "./metrics.js";
import { createWebSocketServer as mountSocketServer } from "./ws.js";

const monitorApp = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const monitoredTypes = new Set(["cpu", "memory", "disk", "uptime"]);

monitorApp.use((req, res, next) => {
  res.type("application/json");
  next();
});

monitorApp.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

monitorApp.get("/metrics", (req, res) => {
  const snapshot = getMetricsSnapshot();
  if (!snapshot) {
    return res.status(503).json({ error: "Metrics not yet available" });
  }
  res.status(200).json(snapshot);
});

monitorApp.get("/metrics/:type", (req, res) => {
  const { type } = req.params;
  if (!monitoredTypes.has(type)) {
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

monitorApp.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

startStatisticsLoop();

const server = http.createServer(monitorApp);
mountSocketServer(server);

server.listen(port, () => {
  console.log(`Resource watch is running on port ${port}`);
});
