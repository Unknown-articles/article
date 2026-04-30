import { WebSocketServer } from 'ws';
import { metricsEmitter, getCachedMetrics } from './metrics.js';

const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const path = req.url;
    let subscriptions = new Set();
    
    // Path-based auto-subscription
    if (path.startsWith('/ws')) {
      const parts = path.split('/');
      const endpoint = parts[2]; // /ws/cpu -> ['','ws','cpu']
      
      if (endpoint === 'all') {
        VALID_TYPES.forEach(t => subscriptions.add(t));
        sendWelcome(ws, Array.from(subscriptions));
        sendSnapshot(ws, Array.from(subscriptions));
      } else if (VALID_TYPES.includes(endpoint)) {
        subscriptions.add(endpoint);
        sendWelcome(ws, Array.from(subscriptions));
        sendSnapshot(ws, [endpoint]);
      } else if (!endpoint) {
        // /ws
        sendWelcome(ws, []);
      } else {
        // unknown endpoint, but valid ws connection
        sendWelcome(ws, []);
      }
    }

    ws.on('message', (message) => {
      let data;
      try {
        data = JSON.parse(message);
      } catch (err) {
        sendError(ws, "Invalid JSON");
        return;
      }

      const { action, metrics } = data;

      if (action !== 'subscribe' && action !== 'unsubscribe') {
        sendError(ws, "Unknown action");
        return;
      }

      if (!Array.isArray(metrics) || metrics.length === 0) {
        sendError(ws, "Empty metrics array");
        return;
      }

      for (const m of metrics) {
        if (!VALID_TYPES.includes(m) && m !== 'all') {
          sendError(ws, `Unknown metric type: ${m}`);
          return;
        }
      }

      const effectiveMetrics = [];
      metrics.forEach(m => {
        if (m === 'all') effectiveMetrics.push(...VALID_TYPES);
        else effectiveMetrics.push(m);
      });
      const uniqueMetrics = [...new Set(effectiveMetrics)];

      if (action === 'subscribe') {
        const newlySubscribed = [];
        uniqueMetrics.forEach(m => {
          if (!subscriptions.has(m)) {
            subscriptions.add(m);
            newlySubscribed.push(m);
          }
        });
        
        ws.send(JSON.stringify({
          event: "ack",
          action: "subscribe",
          metrics,
          subscribedTo: Array.from(subscriptions)
        }));

        if (newlySubscribed.length > 0) {
          sendSnapshot(ws, newlySubscribed);
        }
      } else if (action === 'unsubscribe') {
        uniqueMetrics.forEach(m => subscriptions.delete(m));
        
        ws.send(JSON.stringify({
          event: "ack",
          action: "unsubscribe",
          metrics,
          subscribedTo: Array.from(subscriptions)
        }));
      }
    });

    const onMetrics = (globalMetrics) => {
      if (subscriptions.size === 0) return;
      
      const payload = { timestamp: globalMetrics.timestamp };
      let hasData = false;
      
      for (const sub of subscriptions) {
        if (globalMetrics[sub]) {
          payload[sub] = globalMetrics[sub];
          hasData = true;
        }
      }
      
      if (hasData && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    metricsEmitter.on('metrics', onMetrics);

    ws.on('close', () => {
      metricsEmitter.off('metrics', onMetrics);
    });
  });

  return wss;
}

function sendWelcome(ws, subscribedTo) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      event: "connected",
      subscribedTo,
      validTypes: ["all", ...VALID_TYPES]
    }));
  }
}

function sendSnapshot(ws, typesToSend) {
  const metrics = getCachedMetrics();
  const payload = { timestamp: metrics.timestamp };
  
  for (const t of typesToSend) {
    if (metrics[t]) {
      payload[t] = metrics[t];
    }
  }
  
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendError(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      event: "error",
      message
    }));
  }
}
