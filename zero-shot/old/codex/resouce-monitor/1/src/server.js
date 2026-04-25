import http from "node:http";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { metricsService } from "./services/metricsService.js";
import { attachWebSocketServer } from "./websocket/server.js";

const app = createApp();
const server = http.createServer(app);
const websocketServer = attachWebSocketServer(server);

metricsService.on("error", (error) => {
  console.error("Metrics collection error:", error.message);
});

metricsService.start();

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully.`);
  metricsService.stop();
  websocketServer.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, () => {
  console.log(`Resource Monitor API listening on port ${PORT}`);
});
