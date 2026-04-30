import http from 'http';
import app from './app.js';
import { setupWebSocket } from './ws.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
