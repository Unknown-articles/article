import http from 'node:http';
import express from 'express';
import { getLatestSnapshot, METRIC_TYPES, startMetricsCollection } from './metrics.js';
import { createResourceWebSocketServer } from './websocket.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', (_req, res) => {
  res.json(getLatestSnapshot());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;

  if (!METRIC_TYPES.includes(type)) {
    res.status(400).json({ error: `Unknown metric type: ${type}` });
    return;
  }

  const snapshot = getLatestSnapshot();
  res.json({
    type,
    timestamp: snapshot.timestamp,
    data: snapshot[type]
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = http.createServer(app);
const webSocketServer = createResourceWebSocketServer(server, getLatestSnapshot);

await startMetricsCollection((snapshot) => {
  webSocketServer.broadcast(snapshot);
});

server.listen(PORT, () => {
  console.log(`Resource Monitor API listening on port ${PORT}`);
});
