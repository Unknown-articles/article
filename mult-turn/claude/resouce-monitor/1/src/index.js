import http from 'http';
import express from 'express';
import {
  startMetricsCollection,
  getCpuSnapshot,
  getMemorySnapshot,
  getDiskSnapshot,
  getUptimeSnapshot,
  getFullSnapshot,
} from './metrics.js';
import { attachWebSocketServer } from './ws.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

startMetricsCollection(1000);

const VALID_TYPES = new Map([
  ['cpu', getCpuSnapshot],
  ['memory', getMemorySnapshot],
  ['disk', getDiskSnapshot],
  ['uptime', getUptimeSnapshot],
]);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (_req, res) => {
  res.status(200).json(getFullSnapshot());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const getter = VALID_TYPES.get(type);
  if (!getter) {
    return res.status(400).json({ error: `Unknown metric type: "${type}"` });
  }
  res.status(200).json(getter());
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
