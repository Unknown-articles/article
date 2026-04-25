import express from 'express';
import { WebSocketServer } from 'ws';
import { monitoringEngine } from './metrics.js';

monitoringEngine.start(1000);


const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (req, res) => {
  res.status(200).json(monitoringEngine.fetchFullSnapshot());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type '${type}'. Valid types are ${validTypes.join(', ')}.` });
  }

  res.status(200).json(monitoringEngine.fetchSnapshot(type));
});


// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });
const socketClients = new Set();

server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  socketClients.add(ws);

  const urlPath = request.url.split('?')[0].replace(/\/$/, '') || '/ws';
  let subscriptions = [];
  const supportedMetrics = ['cpu', 'memory', 'disk', 'uptime'];

  if (urlPath === '/ws/all') {
    subscriptions = [...supportedMetrics];
  } else if (urlPath.startsWith('/ws/') && supportedMetrics.includes(urlPath.substring(4))) {
    subscriptions = [urlPath.substring(4)];
  }

  // Bind for future interval broadcasting if needed
  ws.subscriptions = subscriptions;

  const welcomeMessage = JSON.stringify({
    event: 'connected',
    subscriptions,
    validTypes: ['all', 'cpu', 'memory', 'disk', 'uptime']
  });

  ws.send(welcomeMessage, (err) => {
    if (err) {
      console.error('Error sending welcome message', err);
    }
  });

  if (subscriptions.length > 0) {
    const fullSnap = monitoringEngine.fetchFullSnapshot();
    const immediateSnapshot = { timestamp: fullSnap.timestamp };
    
    for (const type of subscriptions) {
      if (fullSnap[type] !== undefined) {
        immediateSnapshot[type] = fullSnap[type];
      }
    }

    ws.send(JSON.stringify(immediateSnapshot), (err) => {
      // Ignore broadcast errors
    });
  }

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      return ws.send(JSON.stringify({ event: 'error', message: 'Input was not valid JSON' }), (e) => {});
    }

    if (!data.action || (data.action !== 'subscribe' && data.action !== 'unsubscribe')) {
      return ws.send(JSON.stringify({ event: 'error', message: 'Unknown or missing action' }), (e) => {});
    }

    if (!data.metrics || !Array.isArray(data.metrics) || data.metrics.length === 0) {
      return ws.send(JSON.stringify({ event: 'error', message: 'At least one metric type is required in metrics array' }), (e) => {});
    }

    const supportedMetrics = ['cpu', 'memory', 'disk', 'uptime'];
    const validWithAll = [...supportedMetrics, 'all'];
    const invalidTypes = data.metrics.filter(m => !validWithAll.includes(m));

    if (invalidTypes.length > 0) {
      return ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${invalidTypes.map(t => `'${t}'`).join(', ')}` }), (e) => {});
    }

    if (data.action === 'subscribe') {
      let toAdd = new Set();
      for (const type of data.metrics) {
        if (type === 'all') {
          supportedMetrics.forEach(m => toAdd.add(m));
        } else {
          toAdd.add(type);
        }
      }
      
      const newlyAdded = [];
      for (const type of toAdd) {
        if (!ws.subscriptions.includes(type)) {
          ws.subscriptions.push(type);
          newlyAdded.push(type);
        }
      }

      ws.send(JSON.stringify({
        event: 'ack',
        action: 'subscribe',
        metrics: newlyAdded,
        subscriptions: ws.subscriptions
      }), (e) => {});

      if (newlyAdded.length > 0) {
        const fullSnap = monitoringEngine.fetchFullSnapshot();
        const immediateSnapshot = { timestamp: fullSnap.timestamp };
        for (const type of newlyAdded) {
          if (fullSnap[type] !== undefined) {
            immediateSnapshot[type] = fullSnap[type];
          }
        }
        ws.send(JSON.stringify(immediateSnapshot), (e) => {});
      }

    } else if (data.action === 'unsubscribe') {
      const toRemove = new Set();
      for (const type of data.metrics) {
        if (type === 'all') {
          supportedMetrics.forEach(m => toRemove.add(m));
        } else {
          toRemove.add(type);
        }
      }

      const actuallyRemoved = [];
      const newSubscribedTo = [];
      for (const type of ws.subscriptions) {
        if (toRemove.has(type)) {
          actuallyRemoved.push(type);
        } else {
          newSubscribedTo.push(type);
        }
      }
      ws.subscriptions = newSubscribedTo;

      ws.send(JSON.stringify({
        event: 'ack',
        action: 'unsubscribe',
        metrics: actuallyRemoved,
        subscriptions: ws.subscriptions
      }), (e) => {});
    }
  });

  ws.on('close', () => {
    socketClients.delete(ws);
  });

  ws.on('error', (err) => {
    // Prevent crashes from socket errors mid-broadcast
    socketClients.delete(ws);
  });
});

monitoringEngine.onTick = (fullSnap) => {
  for (const ws of socketClients) {
    if (ws.subscriptions && ws.subscriptions.length > 0) {
      const snap = { timestamp: fullSnap.timestamp };
      
      for (const type of ws.subscriptions) {
        if (fullSnap[type] !== undefined) {
          snap[type] = fullSnap[type];
        }
      }

      ws.send(JSON.stringify(snap), (err) => {
        // Ignore broadcast errors cleanly
      });
    }
  }
};

