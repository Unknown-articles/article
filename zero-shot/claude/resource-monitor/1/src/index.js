import http from 'http';
import express from 'express';
import { startCollection } from './metrics/cache.js';
import metricsRouter from './routes/metrics.js';
import { attachWebSocket } from './ws/server.js';

const PORT = process.env.PORT ?? 3000;

const app = express();
app.use(express.json());

app.use('/', metricsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = http.createServer(app);
attachWebSocket(server);
startCollection();

server.listen(PORT, () => {
  console.log(`Resource Monitor listening on port ${PORT}`);
});

export { server };
