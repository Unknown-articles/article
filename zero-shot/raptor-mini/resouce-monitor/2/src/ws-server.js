import { WebSocketServer } from 'ws';

const VALID_METRICS = ['cpu', 'memory', 'disk', 'uptime'];
const VALID_TYPES = ['all', ...VALID_METRICS];

const normalizeRequestedMetrics = (metrics) => {
  const normalized = Array.isArray(metrics)
    ? metrics.map((metric) => String(metric).toLowerCase())
    : [];
  return normalized;
};

const buildFilteredSnapshot = (snapshot, subscribedTo) => {
  const payload = { timestamp: snapshot.timestamp };

  if (subscribedTo.has('cpu') || subscribedTo.has('all')) {
    payload.cpu = snapshot.cpu;
  }
  if (subscribedTo.has('memory') || subscribedTo.has('all')) {
    payload.memory = snapshot.memory;
  }
  if (subscribedTo.has('disk') || subscribedTo.has('all')) {
    payload.disk = snapshot.disk;
  }
  if (subscribedTo.has('uptime') || subscribedTo.has('all')) {
    payload.uptime = snapshot.uptime;
  }

  return payload;
};

const createWelcomeMessage = (subscribedTo) => ({
  event: 'connected',
  subscribedTo: [...subscribedTo],
  validTypes: VALID_TYPES
});

const createAckMessage = (action, changedMetrics, subscribedTo) => ({
  event: 'ack',
  action,
  metrics: changedMetrics,
  subscribedTo: [...subscribedTo]
});

const createErrorMessage = (message) => ({
  event: 'error',
  message
});

const getAutoSubscribeFromPath = (pathname) => {
  switch (pathname) {
    case '/ws/cpu':
      return ['cpu'];
    case '/ws/memory':
      return ['memory'];
    case '/ws/disk':
      return ['disk'];
    case '/ws/uptime':
      return ['uptime'];
    case '/ws/all':
      return [...VALID_METRICS];
    case '/ws':
      return [];
    default:
      return null;
  }
};

const isValidMetricType = (metric) => VALID_TYPES.includes(metric);

const createWebSocketServer = (server, metricsEvents, getSnapshot) => {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map();

  const sendJson = (ws, payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const sendSnapshotToClient = (ws, subscribedTo, snapshot) => {
    const payload = buildFilteredSnapshot(snapshot, subscribedTo);
    if (Object.keys(payload).length > 1) {
      sendJson(ws, payload);
    }
  };

  const handleSubscriptionUpdate = (ws, action, requestedMetrics) => {
    const subscribedTo = clients.get(ws);
    const previous = new Set(subscribedTo);
    const normalized = normalizeRequestedMetrics(requestedMetrics);

    if (normalized.length === 0) {
      sendJson(ws, createErrorMessage('metrics array must contain at least one metric type')); 
      return;
    }

    for (const metric of normalized) {
      if (!isValidMetricType(metric)) {
        sendJson(ws, createErrorMessage(`Unknown metric type: ${metric}`));
        return;
      }
    }

    if (action === 'subscribe') {
      if (normalized.includes('all')) {
        VALID_METRICS.forEach((metric) => subscribedTo.add(metric));
      } else {
        normalized.forEach((metric) => {
          if (VALID_METRICS.includes(metric)) {
            subscribedTo.add(metric);
          }
        });
      }
    } else if (action === 'unsubscribe') {
      if (normalized.includes('all')) {
        VALID_METRICS.forEach((metric) => subscribedTo.delete(metric));
      } else {
        normalized.forEach((metric) => subscribedTo.delete(metric));
      }
    }

    const changedMetrics = normalized.filter((metric) => metric === 'all' || VALID_METRICS.includes(metric));
    sendJson(ws, createAckMessage(action, changedMetrics, subscribedTo));

    if (action === 'subscribe') {
      const snapshot = getSnapshot();
      const requestedSet = new Set();

      if (normalized.includes('all')) {
        VALID_METRICS.forEach((metric) => requestedSet.add(metric));
      } else {
        normalized.forEach((metric) => {
          if (VALID_METRICS.includes(metric)) {
            requestedSet.add(metric);
          }
        });
      }

      if (requestedSet.size > 0) {
        const payload = buildFilteredSnapshot(snapshot, requestedSet);
        sendJson(ws, payload);
      }
    }
  };

  wss.on('connection', (ws, request) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const initialMetrics = getAutoSubscribeFromPath(pathname);
    if (initialMetrics === null) {
      ws.close(1008, 'Unsupported WebSocket endpoint');
      return;
    }

    const subscribedSet = new Set(initialMetrics);
    clients.set(ws, subscribedSet);
    sendJson(ws, createWelcomeMessage(subscribedSet));

    if (initialMetrics.length > 0) {
      const snapshot = getSnapshot();
      sendSnapshotToClient(ws, subscribedSet, snapshot);
    }

    ws.on('message', (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message.toString());
      } catch (error) {
        sendJson(ws, createErrorMessage('Invalid JSON payload')); 
        return;
      }

      const { action, metrics } = parsed;
      if (action !== 'subscribe' && action !== 'unsubscribe') {
        sendJson(ws, createErrorMessage(`Unknown action: ${String(action)}`));
        return;
      }

      handleSubscriptionUpdate(ws, action, metrics);
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  metricsEvents.on('update', (snapshot) => {
    for (const [ws, subscribedTo] of clients.entries()) {
      if (ws.readyState !== ws.OPEN) {
        clients.delete(ws);
        continue;
      }

      if (subscribedTo.size === 0) {
        continue;
      }

      sendSnapshotToClient(ws, subscribedTo, snapshot);
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
};

export { createWebSocketServer };
