import express from 'express';
import { createServer } from 'http';
import router from './routes.js';
import { attachWebSocket } from './ws.js';

const PORT = process.env.PORT ?? 5000;

const app = express();
app.use(express.json());

app.use('/', router);

// 404 for any unmatched HTTP routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`Resource Monitor listening on http://localhost:${PORT}`);
});
