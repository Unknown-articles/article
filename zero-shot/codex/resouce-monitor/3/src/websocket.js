import { WebSocketServer } from 'ws';
import { METRIC_TYPES, pickMetrics, VALID_STREAM_TYPES } from './metrics.js';

function sendJson(client, payload) {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(payload));
  }
}

function normalizeMetrics(metrics) {
  const normalized = new Set();

  for (const metric of metrics) {
    if (!VALID_STREAM_TYPES.includes(metric)) {
      throw new Error(`Unknown metric type: ${metric}`);
    }

    if (metric === 'all') {
      for (const type of METRIC_TYPES) {
        normalized.add(type);
      }
    } else {
      normalized.add(metric);
    }
  }

  return [...normalized];
}

function validateClientMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new Error('Message must be a JSON object');
  }

  if (!['subscribe', 'unsubscribe'].includes(message.action)) {
    throw new Error(`Unknown action: ${message.action}`);
  }

  if (!Array.isArray(message.metrics)) {
    throw new Error('metrics must be an array');
  }

  if (message.metrics.length === 0) {
    throw new Error('metrics array must not be empty');
  }

  return {
    action: message.action,
    metrics: normalizeMetrics(message.metrics)
  };
}

function createSnapshotFor(client, snapshot, metrics) {
  return pickMetrics(snapshot, new Set(metrics ?? client.subscriptions));
}

export function createResourceWebSocketServer(server, getLatestSnapshot) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const match = url.pathname.match(/^\/ws(?:\/([^/]+))?$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const streamType = match[1];
    if (streamType && !VALID_STREAM_TYPES.includes(streamType)) {
      socket.destroy();
      return;
    }

    request.resourceMonitorStreamType = streamType ?? null;
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });

  wss.on('connection', (client, request) => {
    const streamType = request.resourceMonitorStreamType;
    client.subscriptions = new Set(streamType ? normalizeMetrics([streamType]) : []);

    sendJson(client, {
      event: 'connected',
      subscribedTo: [...client.subscriptions],
      validTypes: VALID_STREAM_TYPES
    });

    if (client.subscriptions.size > 0) {
      sendJson(client, createSnapshotFor(client, getLatestSnapshot()));
    }

    client.on('message', (rawMessage) => {
      let parsed;
      try {
        parsed = JSON.parse(rawMessage.toString());
      } catch {
        sendJson(client, { event: 'error', message: 'Invalid JSON received' });
        return;
      }

      let requestMessage;
      try {
        requestMessage = validateClientMessage(parsed);
      } catch (error) {
        sendJson(client, { event: 'error', message: error.message });
        return;
      }

      const changedMetrics = [];
      for (const metric of requestMessage.metrics) {
        if (requestMessage.action === 'subscribe' && !client.subscriptions.has(metric)) {
          client.subscriptions.add(metric);
          changedMetrics.push(metric);
        }

        if (requestMessage.action === 'unsubscribe' && client.subscriptions.has(metric)) {
          client.subscriptions.delete(metric);
          changedMetrics.push(metric);
        }
      }

      sendJson(client, {
        event: 'ack',
        action: requestMessage.action,
        metrics: changedMetrics,
        subscribedTo: [...client.subscriptions]
      });

      if (requestMessage.action === 'subscribe' && changedMetrics.length > 0) {
        sendJson(client, createSnapshotFor(client, getLatestSnapshot(), changedMetrics));
      }
    });
  });

  return {
    broadcast(snapshot) {
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN && client.subscriptions?.size > 0) {
          sendJson(client, createSnapshotFor(client, snapshot));
        }
      }
    }
  };
}
