import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSnapshot } from '../services/metricsService.js';

const router = Router();
router.use(requireAuth);

// GET /metrics — full snapshot
router.get('/', (req, res) => {
  res.json(getSnapshot());
});

// GET /metrics/:type — single metric (cpu | memory | uptime)
router.get('/:type', (req, res) => {
  const snap = getSnapshot();
  const { type } = req.params;
  if (!(type in snap))
    return res.status(404).json({ error: 'not_found', message: `Metric '${type}' not available` });
  res.json({ [type]: snap[type] });
});

export default router;
