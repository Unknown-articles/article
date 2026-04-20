import express from 'express';
import { createServer } from 'http';
import { PORT } from './config.js';
import { seedDatabase } from './db/sqlite.js';
import { startMetricsCollection } from './services/metricsService.js';
import { setupWebSocket, broadcastMetrics } from './websocket/wsServer.js';
import { errorHandler } from './middleware/errorHandler.js';
import oidcRouter    from './routes/oidc.js';
import dbJsonRouter  from './routes/dbJson.js';
import metricsRouter from './routes/metrics.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/', oidcRouter);
app.use('/api', dbJsonRouter);
app.use('/metrics', metricsRouter);

app.use(errorHandler);

const server = createServer(app);

await seedDatabase();
setupWebSocket(server);
startMetricsCollection(1000, broadcastMetrics);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          Unified Backend Platform — running              ║
╠══════════════════════════════════════════════════════════╣
║  Health       GET  http://localhost:${PORT}/health           ║
║  Discovery    GET  http://localhost:${PORT}/.well-known/…    ║
║  Authorize    GET  http://localhost:${PORT}/oauth2/authorize ║
║  Token        POST http://localhost:${PORT}/oauth2/token     ║
║  UserInfo     GET  http://localhost:${PORT}/userinfo         ║
║  JSON DB API       http://localhost:${PORT}/api/:collection  ║
║  Metrics      GET  http://localhost:${PORT}/metrics          ║
║  WebSocket    ws://localhost:${PORT}/ws                      ║
╚══════════════════════════════════════════════════════════╝
`);
});
