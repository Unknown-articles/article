import { Router } from 'express';
import { getMetrics } from '../services/metrics.js';

const router = Router();

router.get('/', (_req, res) => res.json(getMetrics()));
router.get('/:type', (req, res) => {
  const metrics = getMetrics();
  const { type } = req.params;
  if (!(type in metrics)) return res.status(404).json({ error: 'Unknown metric type' });
  res.json({ [type]: metrics[type], timestamp: metrics.timestamp });
});

export default router;
