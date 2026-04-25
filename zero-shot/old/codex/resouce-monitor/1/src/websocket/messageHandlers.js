import { METRIC_TYPES } from "../config.js";
import { buildMetricsPayload, normalizeMetrics } from "./subscriptions.js";

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

export function sendSubscriptionError(ws, message) {
  sendJson(ws, {
    type: "error",
    error: message,
    supportedMetrics: METRIC_TYPES
  });
}

export function sendSnapshot(ws, snapshot, subscriptions) {
  if (!subscriptions.size) {
    return;
  }

  sendJson(ws, {
    type: "metrics",
    data: buildMetricsPayload(snapshot, [...subscriptions])
  });
}

export function handleSubscriptionMessage(ws, rawMessage, clientState, snapshot) {
  let message;

  try {
    message = JSON.parse(rawMessage.toString());
  } catch {
    sendSubscriptionError(ws, "Message must be valid JSON");
    return;
  }

  const { action, metrics } = message;
  const normalizedMetrics = normalizeMetrics(Array.isArray(metrics) ? metrics : []);

  if (!["subscribe", "unsubscribe"].includes(action)) {
    sendSubscriptionError(ws, "Action must be subscribe or unsubscribe");
    return;
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    sendSubscriptionError(ws, "Metrics must be a non-empty array");
    return;
  }

  if (normalizedMetrics.length !== metrics.length) {
    sendSubscriptionError(ws, "One or more requested metrics are invalid");
    return;
  }

  if (action === "subscribe") {
    normalizedMetrics.forEach((metric) => clientState.subscriptions.add(metric));
  } else {
    normalizedMetrics.forEach((metric) => clientState.subscriptions.delete(metric));
  }

  sendJson(ws, {
    type: "subscription:update",
    subscriptions: [...clientState.subscriptions]
  });

  sendSnapshot(ws, snapshot, clientState.subscriptions);
}
