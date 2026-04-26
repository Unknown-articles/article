import http from 'http';
import app from './app.js';
import { createWsServer, broadcast } from './ws/wsServer.js';
import { startCollection } from './metricsCache.js';
import { PORT } from './config.js';

const server = http.createServer(app);
const wss = createWsServer(server);

startCollection((snapshot) => broadcast(wss, snapshot));

server.listen(PORT, () => {
  console.log(`Resource Monitor listening on port ${PORT}`);
});
