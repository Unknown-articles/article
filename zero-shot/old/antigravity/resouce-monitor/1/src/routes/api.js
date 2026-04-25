import express from 'express';
import { getLatestMetrics } from '../services/metrics.js';

const router = express.Router();

router.get('/metrics', (req, res) => {
    res.json(getLatestMetrics());
});

router.get('/metrics/:type', (req, res) => {
    const { type } = req.params;
    const metrics = getLatestMetrics();
    if (metrics.hasOwnProperty(type)) {
        res.json({ [type]: metrics[type] });
    } else {
        res.status(404).json({ error: `Metric type '${type}' not found.` });
    }
});

export default router;
