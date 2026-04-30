import express from 'express';
import { getCachedMetrics } from './metrics.js';

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.get('/metrics', (req, res) => {
  res.json(getCachedMetrics());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }

  const metrics = getCachedMetrics();
  res.json({
    type,
    timestamp: metrics.timestamp,
    data: metrics[type]
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default app;
