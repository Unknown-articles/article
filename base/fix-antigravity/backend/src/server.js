import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import oidcRouter from './routes/oidc.js';
import metricsRouter from './routes/metrics.js';
import genericApiRouter from './routes/genericApi.js';
import { setupMonitorWs } from './ws/monitor.js';
import { setupChatWs } from './ws/chat.js';

const app = express();
const server = createServer(app);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/', oidcRouter);
app.use('/metrics', metricsRouter);
app.use('/', genericApiRouter);

const monitorWss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });
setupMonitorWs(monitorWss);
setupChatWs(chatWss);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/ws/chat') {
    chatWss.handleUpgrade(req, socket, head, ws => chatWss.emit('connection', ws, req));
  } else if (['/ws/cpu', '/ws/memory', '/ws/all', '/ws/disk', '/ws/network', '/ws/gpu'].some(p => pathname.startsWith(p))) {
    monitorWss.handleUpgrade(req, socket, head, ws => monitorWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
export { server };