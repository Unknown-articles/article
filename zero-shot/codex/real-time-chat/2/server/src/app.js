import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use("/auth", createAuthRouter());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}
