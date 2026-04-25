import express from "express";
import metricsRoutes from "./routes/metricsRoutes.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(metricsRoutes);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: `Route ${req.method} ${req.originalUrl} not found`
    });
  });

  return app;
}
