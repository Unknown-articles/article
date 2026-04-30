import { WebSocketServer, WebSocket } from 'ws';
import { METRIC_TYPES, VALID_TYPES, ensureInitialSnapshot } from './metricsCollector.js';

const WS_PATHS = new Map([
  ['/ws', []],
  ['/ws/cpu', ['cpu']],
  ['/ws/memory', ['memory']],
  ['/ws/disk', ['disk']],
  ['/ws/uptime', ['uptime']],
  ['/ws/all', [...METRIC_TYPES]]
]);

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getOrderedSubscriptions(subscriptions) {
  return METRIC_TYPES.filter((type) => subscriptions.has(type));
}

function buildMetricSnapshot(snapshot, subscriptions) {
  const payload = {
    timestamp: snapshot.timestamp
  };

  for (const type of getOrderedSubscriptions(subscriptions)) {
    payload[type] = snapshot[type];
  }

  return payload;
}

function sendMetricSnapshot(socket, snapshot, metrics = socket.subscriptions) {
  const subscriptions = metrics instanceof Set ? metrics : new Set(metrics);

  if (subscriptions.size === 0) {
    return;
  }

  sendJson(socket, buildMetricSnapshot(snapshot, subscriptions));
}

function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) {
    return { error: 'metrics must be a non-empty array' };
  }

  if (metrics.length === 0) {
    return { error: 'metrics array must not be empty' };
  }

  const expanded = new Set();

  for (const metric of metrics) {
    if (!VALID_TYPES.includes(metric)) {
      return { error: `Unknown metric type: ${metric}` };
    }

    if (metric === 'all') {
      for (const type of METRIC_TYPES) {
        expanded.add(type);
      }
    } else {
      expanded.add(metric);
    }
  }

  return { metrics: [...expanded] };
}

async function handleMessage(socket, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage.toString());
  } catch {
    sendJson(socket, { event: 'error', message: 'Invalid JSON received' });
    return;
  }

  if (!['subscribe', 'unsubscribe'].includes(message.action)) {
    sendJson(socket, { event: 'error', message: `Unknown action: ${message.action}` });
    return;
  }

  const result = normalizeMetrics(message.metrics);

  if (result.error) {
    sendJson(socket, { event: 'error', message: result.error });
    return;
  }

  const changedMetrics = [];

  for (const metric of result.metrics) {
    const hadMetric = socket.subscriptions.has(metric);

    if (message.action === 'subscribe') {
      socket.subscriptions.add(metric);

      if (!hadMetric) {
        changedMetrics.push(metric);
      }
    } else {
      socket.subscriptions.delete(metric);

      if (hadMetric) {
        changedMetrics.push(metric);
      }
    }
  }

  sendJson(socket, {
    event: 'ack',
    action: message.action,
    metrics: changedMetrics,
    subscribedTo: getOrderedSubscriptions(socket.subscriptions)
  });

  if (message.action === 'subscribe' && changedMetrics.length > 0) {
    const snapshot = await ensureInitialSnapshot();
    sendMetricSnapshot(socket, snapshot, changedMetrics);
  }
}

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, 'http://localhost');

    if (!WS_PATHS.has(pathname)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, pathname);
    });
  });

  wss.on('connection', async (socket, request, pathname) => {
    socket.subscriptions = new Set(WS_PATHS.get(pathname));

    sendJson(socket, {
      event: 'connected',
      subscribedTo: getOrderedSubscriptions(socket.subscriptions),
      validTypes: VALID_TYPES
    });

    if (socket.subscriptions.size > 0) {
      const snapshot = await ensureInitialSnapshot();
      sendMetricSnapshot(socket, snapshot);
    }

    socket.on('message', (rawMessage) => {
      void handleMessage(socket, rawMessage);
    });
  });

  function broadcast(snapshot) {
    for (const socket of wss.clients) {
      if (socket.readyState === WebSocket.OPEN && socket.subscriptions?.size > 0) {
        sendMetricSnapshot(socket, snapshot);
      }
    }
  }

  return { broadcast, wss };
}

export { setupWebSocketServer };
