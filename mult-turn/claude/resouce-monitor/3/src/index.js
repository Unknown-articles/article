import http from 'http';
import express from 'express';
import {
  startPolling,
  getCpuRecord,
  getRamRecord,
  getStorageRecord,
  getRuntimeRecord,
  getFullRecord,
} from './metrics.js';
import { bindWebSocket } from './ws.js';

const app = express();
const SERVER_PORT = process.env.PORT ?? 3000;

app.use(express.json());

startPolling(1000);

const KNOWN_TYPES = new Map([
  ['cpu', getCpuRecord],
  ['memory', getRamRecord],
  ['disk', getStorageRecord],
  ['uptime', getRuntimeRecord],
]);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (_req, res) => {
  res.status(200).json(getFullRecord());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const resolver = KNOWN_TYPES.get(type);
  if (!resolver) {
    return res.status(400).json({ error: `Unknown metric type: "${type}"` });
  }
  res.status(200).json(resolver());
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const httpServer = http.createServer(app);
bindWebSocket(httpServer);

httpServer.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});
