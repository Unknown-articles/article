import express from 'express';
import http from 'node:http';
import {
  METRIC_TYPES,
  ensureInitialSnapshot,
  startMetricsCollector
} from './metricsCollector.js';
import { setupWebSocketServer } from './websocketServer.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.type('application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  const snapshot = await ensureInitialSnapshot();
  res.status(200).json(snapshot);
});

app.get('/metrics/:type', async (req, res) => {
  const { type } = req.params;

  if (!METRIC_TYPES.includes(type)) {
    res.status(400).json({ error: `Unknown metric type: ${type}` });
    return;
  }

  const snapshot = await ensureInitialSnapshot();

  res.status(200).json({
    type,
    timestamp: snapshot.timestamp,
    data: snapshot[type]
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = http.createServer(app);
const webSocketServer = setupWebSocketServer(server);
const collector = startMetricsCollector(webSocketServer.broadcast);

server.listen(PORT, () => {
  console.log(`Resource Monitor API listening on port ${PORT}`);
});

export { app, collector, server, webSocketServer };
