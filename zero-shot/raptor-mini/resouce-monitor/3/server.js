import http from "http";
import express from "express";
import { MetricsCache, VALID_METRIC_TYPES } from "./src/metrics.js";
import { attachWebSocketServer } from "./src/wsManager.js";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(express.json());

const metricsCache = new MetricsCache(1000);
await metricsCache.ready;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/metrics", (req, res) => {
  res.json(metricsCache.getSnapshot());
});

app.get("/metrics/:type", (req, res) => {
  const type = req.params.type;

  if (!VALID_METRIC_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }

  const snapshot = metricsCache.getSnapshot();
  res.json({ type, timestamp: snapshot.timestamp, data: snapshot[type] });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const server = http.createServer(app);
attachWebSocketServer(server, metricsCache);

server.listen(PORT, () => {
  console.log(`Resource Monitor API listening on http://localhost:${PORT}`);
});
