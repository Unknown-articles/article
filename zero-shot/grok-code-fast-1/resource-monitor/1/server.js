import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import metricsRoutes from './routes/metrics.js';
import { startMetricsCollection } from './services/metricsService.js';
import { handleWebSocketConnection, broadcastMetrics } from './websocket/handlers.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());

// Routes
app.use('/metrics', metricsRoutes);

// WebSocket
wss.on('connection', handleWebSocketConnection);

// Start metrics collection
startMetricsCollection(broadcastMetrics);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});