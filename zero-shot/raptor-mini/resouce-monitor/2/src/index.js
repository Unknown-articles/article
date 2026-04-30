import express from 'express';
import http from 'http';
import routes from './routes.js';
import { startMetricCollector, metricsEvents, getCachedSnapshot } from './metrics.js';
import { createWebSocketServer } from './ws-server.js';

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

createWebSocketServer(server, metricsEvents, getCachedSnapshot);

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`Resource Monitor API listening on port ${port}`);
});

startMetricCollector();
