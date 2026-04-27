import { Router } from 'express';
import { getSnapshot } from './cache.js';
import { VALID_TYPES } from './metrics.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/metrics', (_req, res) => {
  res.json(getSnapshot());
});

router.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Unknown metric type: "${type}"` });
  }
  const snap = getSnapshot();
  res.json({ type, timestamp: snap.timestamp, data: snap[type] });
});

export default router;
