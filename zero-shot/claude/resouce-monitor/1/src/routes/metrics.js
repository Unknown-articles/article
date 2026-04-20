import { Router } from 'express';
import { getLatestMetrics, getMetricByType } from '../services/metricsService.js';
import { VALID_METRIC_TYPES } from '../config.js';

const router = Router();

// GET /metrics — full snapshot
router.get('/', (req, res) => {
  const metrics = getLatestMetrics();
  if (!metrics) {
    return res.status(503).json({ error: 'Metrics not yet available' });
  }
  res.json(metrics);
});

// GET /metrics/:type — single metric
router.get('/:type', (req, res) => {
  const { type } = req.params;

  if (!VALID_METRIC_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid metric type "${type}". Valid types: ${VALID_METRIC_TYPES.join(', ')}`,
    });
  }

  const metric = getMetricByType(type);
  if (metric === null) {
    return res.status(503).json({ error: 'Metrics not yet available' });
  }

  res.json({ type, timestamp: getLatestMetrics().timestamp, data: metric });
});

export default router;
