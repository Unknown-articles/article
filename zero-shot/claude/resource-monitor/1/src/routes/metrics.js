import { Router } from 'express';
import { getSnapshot } from '../metrics/cache.js';

const router = Router();
const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/metrics', (_req, res) => {
  res.json(getSnapshot());
});

router.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: "${type}". Valid types are: ${VALID_TYPES.join(', ')}` });
  }
  const snapshot = getSnapshot();
  res.json({ type, timestamp: snapshot.timestamp, data: snapshot[type] });
});

export default router;
