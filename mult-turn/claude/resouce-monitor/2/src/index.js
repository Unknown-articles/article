import http from 'http';
import express from 'express';
import {
  initCollection,
  getCpuState,
  getMemState,
  getDiskState,
  getUptimeState,
  getSystemState,
} from './metrics.js';
import { mountWebSocketServer } from './ws.js';

const app = express();
const HTTP_PORT = process.env.PORT ?? 3000;

app.use(express.json());

initCollection(1000);

const METRIC_REGISTRY = new Map([
  ['cpu', getCpuState],
  ['memory', getMemState],
  ['disk', getDiskState],
  ['uptime', getUptimeState],
]);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (_req, res) => {
  res.status(200).json(getSystemState());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const handler = METRIC_REGISTRY.get(type);
  if (!handler) {
    return res.status(400).json({ error: `Unknown metric type: "${type}"` });
  }
  res.status(200).json(handler());
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = http.createServer(app);
mountWebSocketServer(server);

server.listen(HTTP_PORT, () => {
  console.log(`Server listening on port ${HTTP_PORT}`);
});
