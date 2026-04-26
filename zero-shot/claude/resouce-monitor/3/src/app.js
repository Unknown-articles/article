import express from 'express';
import metricsRouter from './routes/metrics.js';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/metrics', metricsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
