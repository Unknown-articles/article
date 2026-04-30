import express from 'express';
import { METRIC_TYPES, getCachedSnapshot } from './metrics.js';

const router = express.Router();

router.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

router.get('/metrics', (req, res) => {
  return res.json(getCachedSnapshot());
});

router.get('/metrics/:type', (req, res) => {
  const metricType = req.params.type;
  if (!METRIC_TYPES.includes(metricType)) {
    return res.status(400).json({ error: `Invalid metric type: ${metricType}` });
  }

  const snapshot = getCachedSnapshot();
  return res.json({
    type: metricType,
    timestamp: snapshot.timestamp,
    data: snapshot[metricType]
  });
});

export default router;
