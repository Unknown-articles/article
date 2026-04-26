import { Router } from 'express';
import { getCache } from '../metricsCache.js';
import { VALID_METRIC_TYPES } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getCache());
});

router.get('/:type', (req, res) => {
  const { type } = req.params;
  if (!VALID_METRIC_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: "${type}". Valid types: ${VALID_METRIC_TYPES.join(', ')}` });
  }
  const snapshot = getCache();
  res.json({ type, timestamp: snapshot.timestamp, data: snapshot[type] });
});

export default router;
