import { WebSocketServer } from "ws";
import { VALID_METRIC_TYPES } from "./metrics.js";

const VALID_WS_TYPES = [...VALID_METRIC_TYPES, "all"];
const AUTO_SUBSCRIPTIONS = new Map([
  ["/ws", []],
  ["/ws/cpu", ["cpu"]],
  ["/ws/memory", ["memory"]],
  ["/ws/disk", ["disk"]],
  ["/ws/uptime", ["uptime"]],
  ["/ws/all", [...VALID_METRIC_TYPES]]
]);

function createJsonMessage(payload) {
  return JSON.stringify(payload);
}

function sendJson(ws, payload) {
  try {
    ws.send(createJsonMessage(payload));
  } catch (error) {
    // ignore send failures for closed sockets
  }
}

function buildClientSnapshot(snapshot, subscribedTo) {
  const payload = { timestamp: snapshot.timestamp };

  if (subscribedTo.has("cpu")) {
    payload.cpu = snapshot.cpu;
  }

  if (subscribedTo.has("memory")) {
    payload.memory = snapshot.memory;
  }

  if (subscribedTo.has("disk")) {
    payload.disk = snapshot.disk;
  }

  if (subscribedTo.has("uptime")) {
    payload.uptime = snapshot.uptime;
  }

  return payload;
}

function normalizeRequestedMetrics(metrics) {
  const requested = new Set();

  metrics.forEach((metric) => {
    if (metric === "all") {
      VALID_METRIC_TYPES.forEach((type) => requested.add(type));
    } else {
      requested.add(metric);
    }
  });

  return [...requested];
}

function validateMetrics(metrics) {
  if (!Array.isArray(metrics)) {
    return { valid: false, error: "Invalid metrics array" };
  }

  if (metrics.length === 0) {
    return { valid: false, error: "Metric list cannot be empty" };
  }

  const unknown = metrics.filter((metric) => !VALID_WS_TYPES.includes(metric));
  if (unknown.length > 0) {
    return { valid: false, error: `Unknown metric type: ${unknown.join(", ")}` };
  }

  return { valid: true };
}

function isWebSocketPath(pathname) {
  return AUTO_SUBSCRIPTIONS.has(pathname);
}

function getSubscriptionList(subscribedSet) {
  return VALID_METRIC_TYPES.filter((type) => subscribedSet.has(type));
}

export function attachWebSocketServer(server, metricsCache) {
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Set();

  function sendWelcome(ws, subscribedTo) {
    sendJson(ws, {
      event: "connected",
      subscribedTo,
      validTypes: VALID_WS_TYPES
    });
  }

  function sendError(ws, message) {
    sendJson(ws, { event: "error", message });
  }

  function sendAck(ws, action, metrics, subscribedTo) {
    sendJson(ws, {
      event: "ack",
      action,
      metrics,
      subscribedTo
    });
  }

  function sendSnapshot(ws, snapshot, subscribedTo) {
    const payload = buildClientSnapshot(snapshot, subscribedTo);
    sendJson(ws, payload);
  }

  function handleSubscriptionUpdate(state, action, requestedMetrics, ws) {
    const normalized = normalizeRequestedMetrics(requestedMetrics);
    const current = state.subscribed;
    const previouslySubscribed = new Set(current);

    if (action === "subscribe") {
      normalized.forEach((metric) => current.add(metric));
    } else if (action === "unsubscribe") {
      normalized.forEach((metric) => current.delete(metric));
    }

    const subscribedTo = getSubscriptionList(current);
    sendAck(ws, action, requestedMetrics, subscribedTo);

    if (action === "subscribe") {
      const snapshot = metricsCache.getSnapshot();
      const newMetrics = normalized.filter((type) => !previouslySubscribed.has(type));
      const sendTypes = newMetrics.length > 0 ? newMetrics : normalized;
      const sendSet = new Set(sendTypes);
      const payload = buildClientSnapshot(snapshot, sendSet);
      sendJson(ws, payload);
    }
  }

  function handleMessage(state, rawData, ws) {
    let message;
    try {
      message = JSON.parse(rawData.toString());
    } catch (error) {
      sendError(ws, "Invalid JSON payload");
      return;
    }

    const { action, metrics } = message;

    if (action !== "subscribe" && action !== "unsubscribe") {
      sendError(ws, `Unknown action: ${action}`);
      return;
    }

    const validation = validateMetrics(metrics);
    if (!validation.valid) {
      sendError(ws, validation.error);
      return;
    }

    handleSubscriptionUpdate(state, action, metrics, ws);
  }

  wss.on("connection", (ws, request, pathname) => {
    const initial = new Set(AUTO_SUBSCRIPTIONS.get(pathname) || []);
    const state = { ws, subscribed: initial };
    sessions.add(state);

    ws.on("message", (rawData) => handleMessage(state, rawData, ws));
    ws.on("close", () => sessions.delete(state));
    ws.on("error", () => sessions.delete(state));

    const subscribedTo = getSubscriptionList(initial);
    sendWelcome(ws, subscribedTo);

    if (subscribedTo.length > 0) {
      const snapshot = metricsCache.getSnapshot();
      sendSnapshot(ws, snapshot, initial);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (!isWebSocketPath(pathname)) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, pathname);
    });
  });

  setInterval(() => {
    const snapshot = metricsCache.getSnapshot();

    sessions.forEach((session) => {
      if (session.subscribed.size === 0) {
        return;
      }

      sendSnapshot(session.ws, snapshot, session.subscribed);
    });
  }, 1000);
}
