import http from "node:http";
import { createApp } from "./app.js";
import { MetricsStore } from "./metrics.js";
import { attachWebSocketServer } from "./websocket.js";

export async function createResourceMonitorServer({ intervalMs = 1000 } = {}) {
  const metricsStore = new MetricsStore({ intervalMs });
  await metricsStore.start();

  const app = createApp({ metricsStore });
  const server = http.createServer(app);
  const websocket = attachWebSocketServer({ server, metricsStore });

  return {
    app,
    server,
    metricsStore,
    websocket,
    async listen(port = 3000) {
      await new Promise((resolve) => {
        server.listen(port, resolve);
      });

      return server.address();
    },
    async close() {
      websocket.close();
      metricsStore.stop();

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
