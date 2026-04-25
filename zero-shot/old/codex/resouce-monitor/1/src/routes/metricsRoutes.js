import { Router } from "express";
import { METRIC_TYPES } from "../config.js";
import { metricsService } from "../services/metricsService.js";

const router = Router();

router.get("/metrics", (_req, res) => {
  res.json(metricsService.getSnapshot());
});

router.get("/metrics/:type", (req, res) => {
  const { type } = req.params;

  if (!METRIC_TYPES.includes(type)) {
    return res.status(400).json({
      error: "Invalid metric type",
      supportedMetrics: METRIC_TYPES
    });
  }

  return res.json(metricsService.getMetric(type));
});

export default router;
