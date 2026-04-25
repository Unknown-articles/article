import { Router } from 'express';
import { getSnapshot } from '../metrics/cache.js';

const router = Router();
const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/metrics', (_req, res) => {
  const data = getSnapshot();
  if (!data) return res.status(503).json({ error: 'Metrics not yet available' });
  res.json(data);
});

router.get('/metrics/:type', (req, res) => {
  const { type } = req.params;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: "${type}"` });
  }

  const data = getSnapshot();
  if (!data) return res.status(503).json({ error: 'Metrics not yet available' });

  res.json({ type, timestamp: data.timestamp, data: data[type] });
});

export default router;
