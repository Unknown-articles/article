import express from 'express';
import { getMetrics, getMetric } from '../services/metricsService.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getMetrics());
});

router.get('/:type', (req, res) => {
  const { type } = req.params;
  const metric = getMetric(type);
  if (metric !== undefined) {
    res.json({ [type]: metric });
  } else {
    res.status(404).json({ error: 'Metric not found' });
  }
});

export default router;