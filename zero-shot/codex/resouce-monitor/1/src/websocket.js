import { WebSocketServer } from "ws";
import { VALID_METRIC_TYPES, VALID_STREAM_TYPES } from "./constants.js";

const WS_PATHS = new Map([
  ["/ws", []],
  ["/ws/cpu", ["cpu"]],
  ["/ws/memory", ["memory"]],
  ["/ws/disk", ["disk"]],
  ["/ws/uptime", ["uptime"]],
  ["/ws/all", [...VALID_METRIC_TYPES]],
]);

function isKnownPath(pathname) {
  return WS_PATHS.has(pathname);
}

function getAutoSubscriptions(pathname) {
  return WS_PATHS.get(pathname) ?? [];
}

function parseMetrics(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return { error: "metrics array must not be empty" };
  }

  const expandedMetrics = [];

  for (const metric of metrics) {
    if (!VALID_STREAM_TYPES.includes(metric)) {
      return { error: `Unknown metric type: ${metric}` };
    }

    if (metric === "all") {
      expandedMetrics.push(...VALID_METRIC_TYPES);
      continue;
    }

    expandedMetrics.push(metric);
  }

  return { metrics: [...new Set(expandedMetrics)] };
}

function buildSnapshot(snapshot, subscriptions) {
  const payload = { timestamp: snapshot.timestamp };

  for (const metric of VALID_METRIC_TYPES) {
    if (subscriptions.has(metric)) {
      payload[metric] = snapshot[metric];
    }
  }

  return payload;
}

function sendJson(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer({ server, metricsStore }) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map();

  function broadcastSnapshot(snapshot) {
    for (const [socket, subscriptions] of clients.entries()) {
      if (subscriptions.size === 0) {
        continue;
      }

      sendJson(socket, buildSnapshot(snapshot, subscriptions));
    }
  }

  metricsStore.on("snapshot", broadcastSnapshot);

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");

    if (!isKnownPath(url.pathname)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request, url.pathname);
    });
  });

  wss.on("connection", (socket, _request, pathname) => {
    const subscriptions = new Set(getAutoSubscriptions(pathname));
    clients.set(socket, subscriptions);

    sendJson(socket, {
      event: "connected",
      subscribedTo: [...subscriptions],
      validTypes: VALID_STREAM_TYPES,
    });

    if (subscriptions.size > 0) {
      sendJson(socket, buildSnapshot(metricsStore.getSnapshot(), subscriptions));
    }

    socket.on("message", (rawMessage) => {
      let message;

      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        sendJson(socket, { event: "error", message: "Invalid JSON received from client" });
        return;
      }

      const { action, metrics } = message;

      if (action !== "subscribe" && action !== "unsubscribe") {
        sendJson(socket, { event: "error", message: `Unknown action: ${action}` });
        return;
      }

      const parsed = parseMetrics(metrics);

      if (parsed.error) {
        sendJson(socket, { event: "error", message: parsed.error });
        return;
      }

      const changed = [];

      for (const metric of parsed.metrics) {
        if (action === "subscribe") {
          if (!subscriptions.has(metric)) {
            subscriptions.add(metric);
            changed.push(metric);
          }
        } else if (subscriptions.delete(metric)) {
          changed.push(metric);
        }
      }

      sendJson(socket, {
        event: "ack",
        action,
        metrics: changed,
        subscribedTo: [...subscriptions],
      });

      if (action === "subscribe" && changed.length > 0) {
        const immediateSubscriptions = new Set(changed);
        sendJson(socket, buildSnapshot(metricsStore.getSnapshot(), immediateSubscriptions));
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });
  });

  return {
    wss,
    clients,
    close() {
      metricsStore.off("snapshot", broadcastSnapshot);

      for (const socket of clients.keys()) {
        socket.close();
      }

      clients.clear();
      wss.close();
    },
  };
}
