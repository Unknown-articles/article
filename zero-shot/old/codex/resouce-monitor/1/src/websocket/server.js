import WebSocket, { WebSocketServer } from "ws";
import { metricsService } from "../services/metricsService.js";
import {
  getDefaultSubscriptions,
  isSupportedPath
} from "./subscriptions.js";
import { handleSubscriptionMessage, sendSnapshot } from "./messageHandlers.js";

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map();
  const heartbeatInterval = setInterval(() => {
    for (const [ws] of clients.entries()) {
      if (ws.isAlive === false) {
        clients.delete(ws);
        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  metricsService.on("metrics", (snapshot) => {
    for (const [ws, clientState] of clients.entries()) {
      if (ws.readyState !== WebSocket.OPEN) {
        clients.delete(ws);
        continue;
      }

      sendSnapshot(ws, snapshot, clientState.subscriptions);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");

    if (!isSupportedPath(url.pathname)) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, url.pathname);
    });
  });

  wss.on("connection", (ws, _request, pathname) => {
    ws.isAlive = true;
    const clientState = {
      subscriptions: new Set(getDefaultSubscriptions(pathname))
    };

    clients.set(ws, clientState);

    ws.send(
      JSON.stringify({
        type: "connection",
        path: pathname,
        subscriptions: [...clientState.subscriptions]
      })
    );

    sendSnapshot(ws, metricsService.getSnapshot(), clientState.subscriptions);

    ws.on("message", (message) => {
      handleSubscriptionMessage(ws, message, clientState, metricsService.getSnapshot());
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  return {
    close() {
      clearInterval(heartbeatInterval);

      for (const [ws] of clients.entries()) {
        ws.close();
      }

      clients.clear();
      wss.close();
    }
  };
}
