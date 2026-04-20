import express from 'express';
import { startMetricsCollection, getCachedSnapshot } from './metrics.js';
import { initializeWebSocketServer } from './websocket.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.type('application/json').send({ status: 'ok' });
});

// Metrics endpoints
app.get('/metrics', (req, res) => {
  const snapshot = getCachedSnapshot();
  if (!snapshot) {
    return res.status(503).type('application/json').send({ error: 'Metrics not yet available' });
  }
  res.type('application/json').send(snapshot);
});

app.get('/metrics/:type', (req, res) => {
  const type = req.params.type;
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).type('application/json').send({ error: `Invalid metric type requested: '${type}'` });
  }
  
  const snapshot = getCachedSnapshot();
  if (!snapshot) {
    return res.status(503).type('application/json').send({ error: 'Metrics not yet available' });
  }
  
  res.type('application/json').send({
    type,
    timestamp: snapshot.timestamp,
    data: snapshot[type]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).type('application/json').send({ error: 'Not found' });
});

startMetricsCollection();

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

initializeWebSocketServer(server);
