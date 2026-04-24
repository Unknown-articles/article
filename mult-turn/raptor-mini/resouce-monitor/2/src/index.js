import http from "http";
import express from "express";
import {
  getCpuSnapshot,
  getMemorySnapshot,
  getDiskSnapshot,
  getUptimeSnapshot,
  getMetricsSnapshot,
  kickOffMetricRefresh,
} from "./metrics.js";
import { createWebSocketServer as initSocketService } from "./ws.js";

const apiApp = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const allowedTypes = new Set(["cpu", "memory", "disk", "uptime"]);

apiApp.use((req, res, next) => {
  res.type("application/json");
  next();
});

apiApp.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

apiApp.get("/metrics", (req, res) => {
  const snapshot = getMetricsSnapshot();
  if (!snapshot) {
    return res.status(503).json({ error: "Metrics not yet available" });
  }
  res.status(200).json(snapshot);
});

apiApp.get("/metrics/:type", (req, res) => {
  const { type } = req.params;
  if (!allowedTypes.has(type)) {
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

apiApp.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

kickOffMetricRefresh();

const server = http.createServer(apiApp);
initSocketService(server);

server.listen(port, () => {
  console.log(`Resource tracker is listening on port ${port}`);
});
