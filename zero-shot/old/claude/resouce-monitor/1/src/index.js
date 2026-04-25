import http from 'http';
import express from 'express';
import metricsRouter from './routes/metrics.js';
import { attachWebSocket } from './websocket/wsHandler.js';
import { startCollection } from './services/metricsService.js';
import { PORT } from './config.js';

const app = express();
app.use(express.json());

// REST routes
app.use('/metrics', metricsRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Create a raw HTTP server so we can share it with the WebSocket server.
const server = http.createServer(app);

// Attach WebSocket handler.
attachWebSocket(server);

// Start metrics collection.
startCollection();

server.listen(PORT, () => {
  console.log(`Resource Monitor running on http://localhost:${PORT}`);
  console.log(`REST  → GET http://localhost:${PORT}/metrics`);
  console.log(`REST  → GET http://localhost:${PORT}/metrics/:type`);
  console.log(`WS    → ws://localhost:${PORT}/ws          (all metrics via messages)`);
  console.log(`WS    → ws://localhost:${PORT}/ws/cpu`);
  console.log(`WS    → ws://localhost:${PORT}/ws/memory`);
  console.log(`WS    → ws://localhost:${PORT}/ws/disk`);
  console.log(`WS    → ws://localhost:${PORT}/ws/uptime`);
  console.log(`WS    → ws://localhost:${PORT}/ws/all`);
});
