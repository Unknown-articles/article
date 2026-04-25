import express from "express";
import { VALID_METRIC_TYPES } from "./constants.js";

export function createApp({ metricsStore } = {}) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/metrics", (_request, response) => {
    response.json(metricsStore.getSnapshot());
  });

  app.get("/metrics/:type", (request, response) => {
    const { type } = request.params;

    if (!VALID_METRIC_TYPES.includes(type)) {
      response.status(400).json({ error: `Unknown metric type: ${type}` });
      return;
    }

    const snapshot = metricsStore.getSnapshot();
    response.json({
      type,
      timestamp: snapshot.timestamp,
      data: snapshot[type],
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not Found" });
  });

  return app;
}
