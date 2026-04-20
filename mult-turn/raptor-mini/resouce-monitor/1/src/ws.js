import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { getMetricsSnapshot, onMetricsTick } from "./metrics.js";

const validTypes = ["all", "cpu", "memory", "disk", "uptime"];
const clients = new Map();

const autoSubscriptionMap = new Map([
  ["/ws", []],
  ["/ws/cpu", ["cpu"]],
  ["/ws/memory", ["memory"]],
  ["/ws/disk", ["disk"]],
  ["/ws/uptime", ["uptime"]],
  ["/ws/all", ["cpu", "memory", "disk", "uptime"]],
]);

const allowedMetrics = ["cpu", "memory", "disk", "uptime"];
const allowedMetricSet = new Set(allowedMetrics);

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function toErrorMessage(unknownTypes) {
  if (!Array.isArray(unknownTypes) || !unknownTypes.length) {
    return "Unknown metric type.";
  }
  if (unknownTypes.length === 1) {
    return `Unknown metric type: '${unknownTypes[0]}'`;
  }
  return `Unknown metric types: ${unknownTypes.map((type) => `'${type}'`).join(", ")}`;
}

function normalizeRequestedMetrics(metrics, action) {
  if (!Array.isArray(metrics)) {
    return { requested: [], invalidTypes: [] };
  }

  const requested = new Set();
  const invalidTypes = [];

  for (const metric of metrics) {
    if (metric === "all") {
      allowedMetrics.forEach((type) => requested.add(type));
      continue;
    }
    if (allowedMetricSet.has(metric)) {
      requested.add(metric);
      continue;
    }
    invalidTypes.push(metric);
  }

  return {
    requested: allowedMetrics.filter((type) => requested.has(type)),
    invalidTypes,
  };
}

function isWebSocketPath(pathname) {
  return pathname === "/ws" || pathname.startsWith("/ws/");
}

function getSubscribedTo(pathname) {
  return autoSubscriptionMap.get(normalizePath(pathname)) ?? [];
}

function createFilteredSnapshot(snapshot, subscribedTo) {
  if (!snapshot) {
    return null;
  }

  const filtered = { timestamp: snapshot.timestamp };
  if (subscribedTo.includes("cpu")) {
    filtered.cpu = snapshot.cpu;
  }
  if (subscribedTo.includes("memory")) {
    filtered.memory = snapshot.memory;
  }
  if (subscribedTo.includes("disk")) {
    filtered.disk = snapshot.disk;
  }
  if (subscribedTo.includes("uptime")) {
    filtered.uptime = snapshot.uptime;
  }

  return filtered;
}

function broadcastSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  for (const [ws, client] of clients.entries()) {
    if (!client.subscribedTo.length) {
      continue;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      clients.delete(ws);
      continue;
    }

    const filteredSnapshot = createFilteredSnapshot(snapshot, client.subscribedTo);
    if (!filteredSnapshot) {
      continue;
    }

    try {
      ws.send(JSON.stringify(filteredSnapshot));
    } catch {
      clients.delete(ws);
    }
  }
}

function createWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (!isWebSocketPath(url.pathname)) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch (error) {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    const subscribedTo = getSubscribedTo(url.pathname);
    clients.set(ws, { ws, subscribedTo });

    ws.send(
      JSON.stringify({
        event: "connected",
        subscribedTo,
        validTypes,
      })
    );

    if (subscribedTo.length > 0) {
      const snapshot = getMetricsSnapshot();
      const filteredSnapshot = createFilteredSnapshot(snapshot, subscribedTo);
      if (filteredSnapshot) {
        ws.send(JSON.stringify(filteredSnapshot));
      }
    }

    const sendError = (message) => {
      try {
        ws.send(JSON.stringify({ event: "error", message }));
      } catch {
        // ignore send failures for error reporting
      }
    };

    ws.on("message", (message) => {
      let payload;
      try {
        payload = JSON.parse(message.toString());
      } catch {
        sendError("Invalid JSON payload.");
        return;
      }

      const { action, metrics } = payload;
      const normalizedAction = typeof action === "string" ? action : null;
      if (normalizedAction !== "subscribe" && normalizedAction !== "unsubscribe") {
        sendError(`Unknown action: ${normalizedAction === null ? "missing" : normalizedAction}`);
        return;
      }

      if (!Array.isArray(payload.metrics) || payload.metrics.length === 0) {
        sendError("At least one metric type is required.");
        return;
      }

      const client = clients.get(ws);
      if (!client) {
        return;
      }

      const { requested, invalidTypes } = normalizeRequestedMetrics(metrics, normalizedAction);
      if (invalidTypes.length > 0) {
        sendError(toErrorMessage(invalidTypes));
        return;
      }

      if (!requested.length) {
        sendError("At least one metric type is required.");
        return;
      }

      const currentSet = new Set(client.subscribedTo);
      const changedMetrics = [];

      if (normalizedAction === "subscribe") {
        for (const metric of requested) {
          if (!currentSet.has(metric)) {
            currentSet.add(metric);
            changedMetrics.push(metric);
          }
        }
      } else {
        for (const metric of requested) {
          if (currentSet.has(metric)) {
            currentSet.delete(metric);
            changedMetrics.push(metric);
          }
        }
      }

      client.subscribedTo = allowedMetrics.filter((type) => currentSet.has(type));
      clients.set(ws, client);

      ws.send(
        JSON.stringify({
          event: "ack",
          action: normalizedAction,
          metrics: changedMetrics,
          subscribedTo: client.subscribedTo,
        })
      );

      if (normalizedAction === "subscribe" && changedMetrics.length > 0) {
        const snapshot = getMetricsSnapshot();
        const filteredSnapshot = createFilteredSnapshot(snapshot, changedMetrics);
        if (filteredSnapshot) {
          ws.send(JSON.stringify(filteredSnapshot));
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  wss.on("error", () => {
    // Silence internal WebSocket server errors to prevent crashes.
  });

  onMetricsTick(broadcastSnapshot);

  return { wss, clients };
}

export { createWebSocketServer, clients, validTypes };
