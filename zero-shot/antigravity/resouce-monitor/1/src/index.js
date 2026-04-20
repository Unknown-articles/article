import express from 'express';
import http from 'http';
import { startMetricsCollection } from './services/metrics.js';
import apiRoutes from './routes/api.js';
import { initWebSocketServer } from './ws/server.js';

const app = express();
const server = http.createServer(app);
const PORT = 3003;

initWebSocketServer(server);

app.use(express.json());
app.use('/', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'Resource Monitor API is running' });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    startMetricsCollection(1000); // Collect every second
});
