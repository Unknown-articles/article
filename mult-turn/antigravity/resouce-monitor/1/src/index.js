import express from 'express';
import { WebSocketServer } from 'ws';
import { metricsEngine } from './metrics.js';

metricsEngine.start(1000);


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
  res.status(200).json(metricsEngine.getFullSnapshot());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type '${type}'. Valid types are ${validTypes.join(', ')}.` });
  }

  res.status(200).json(metricsEngine.getSnapshot(type));
});


// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

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
  clients.add(ws);

  const urlPath = request.url.split('?')[0].replace(/\/$/, '') || '/ws';
  let subscribedTo = [];
  const validMetrics = ['cpu', 'memory', 'disk', 'uptime'];

  if (urlPath === '/ws/all') {
    subscribedTo = [...validMetrics];
  } else if (urlPath.startsWith('/ws/') && validMetrics.includes(urlPath.substring(4))) {
    subscribedTo = [urlPath.substring(4)];
  }

  // Bind for future interval broadcasting if needed
  ws.subscribedTo = subscribedTo;

  const welcomeMessage = JSON.stringify({
    event: 'connected',
    subscribedTo,
    validTypes: ['all', 'cpu', 'memory', 'disk', 'uptime']
  });

  ws.send(welcomeMessage, (err) => {
    if (err) {
      console.error('Error sending welcome message', err);
    }
  });

  if (subscribedTo.length > 0) {
    const fullSnap = metricsEngine.getFullSnapshot();
    const immediateSnapshot = { timestamp: fullSnap.timestamp };
    
    for (const type of subscribedTo) {
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

    const validMetrics = ['cpu', 'memory', 'disk', 'uptime'];
    const validWithAll = [...validMetrics, 'all'];
    const invalidTypes = data.metrics.filter(m => !validWithAll.includes(m));

    if (invalidTypes.length > 0) {
      return ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${invalidTypes.map(t => `'${t}'`).join(', ')}` }), (e) => {});
    }

    if (data.action === 'subscribe') {
      let toAdd = new Set();
      for (const type of data.metrics) {
        if (type === 'all') {
          validMetrics.forEach(m => toAdd.add(m));
        } else {
          toAdd.add(type);
        }
      }
      
      const newlyAdded = [];
      for (const type of toAdd) {
        if (!ws.subscribedTo.includes(type)) {
          ws.subscribedTo.push(type);
          newlyAdded.push(type);
        }
      }

      ws.send(JSON.stringify({
        event: 'ack',
        action: 'subscribe',
        metrics: newlyAdded,
        subscribedTo: ws.subscribedTo
      }), (e) => {});

      if (newlyAdded.length > 0) {
        const fullSnap = metricsEngine.getFullSnapshot();
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
          validMetrics.forEach(m => toRemove.add(m));
        } else {
          toRemove.add(type);
        }
      }

      const actuallyRemoved = [];
      const newSubscribedTo = [];
      for (const type of ws.subscribedTo) {
        if (toRemove.has(type)) {
          actuallyRemoved.push(type);
        } else {
          newSubscribedTo.push(type);
        }
      }
      ws.subscribedTo = newSubscribedTo;

      ws.send(JSON.stringify({
        event: 'ack',
        action: 'unsubscribe',
        metrics: actuallyRemoved,
        subscribedTo: ws.subscribedTo
      }), (e) => {});
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    // Prevent crashes from socket errors mid-broadcast
    clients.delete(ws);
  });
});

metricsEngine.onTick = (fullSnap) => {
  for (const ws of clients) {
    if (ws.subscribedTo && ws.subscribedTo.length > 0) {
      const snap = { timestamp: fullSnap.timestamp };
      
      for (const type of ws.subscribedTo) {
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
