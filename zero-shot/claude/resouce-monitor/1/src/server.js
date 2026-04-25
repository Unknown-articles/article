import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api.js';
import { handleConnection, broadcast } from './websocket/handler.js';
import { startCollection, onRefresh } from './metrics/cache.js';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use('/', apiRouter);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, req.url);
    });
  } else {
    socket.destroy();
  }
});

startCollection();
onRefresh(broadcast);

server.listen(PORT, () => {
  console.log(`Resource Monitor API running on port ${PORT}`);
});

export { server };
