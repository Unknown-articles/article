import { WebSocketServer } from 'ws';
import { metricsEmitter } from '../services/metrics.js';

let wss;
const clients = new Map();

export function initWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
        
        const subscriptions = new Set();
        clients.set(ws, subscriptions);

        // Path-based auto-subscription
        // Paths might look like /ws/cpu, /ws/memory, /ws/all, etc.
        const pathSegments = req.url.split('?')[0].split('/');
        const wsSubPath = pathSegments[pathSegments.length - 1]; // e.g., 'cpu'

        if (wsSubPath && wsSubPath !== '' && wsSubPath !== 'ws') { // simple check to ignore root /ws connections
            if (wsSubPath === 'all') {
                subscriptions.add('cpu').add('memory').add('disk').add('uptime');
            } else {
                subscriptions.add(wsSubPath);
            }
            ws.send(JSON.stringify({ status: 'subscribed', subscribedTo: Array.from(subscriptions) }));
        }

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.action === 'subscribe' && Array.isArray(data.metrics)) {
                    data.metrics.forEach(m => subscriptions.add(m));
                    ws.send(JSON.stringify({ status: 'subscribed', subscribedTo: Array.from(subscriptions) }));
                } else if (data.action === 'unsubscribe' && Array.isArray(data.metrics)) {
                    data.metrics.forEach(m => subscriptions.delete(m));
                    ws.send(JSON.stringify({ status: 'unsubscribed', subscribedTo: Array.from(subscriptions) }));
                } else {
                    ws.send(JSON.stringify({ error: 'Invalid action or missing metrics array' }));
                }
            } catch (e) {
                ws.send(JSON.stringify({ error: 'Invalid message format. Expected JSON.' }));
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            clients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            clients.delete(ws);
        });
    });

    metricsEmitter.on('update', (metrics) => {
        for (const [ws, subscriptions] of clients.entries()) {
            if (ws.readyState === 1 && subscriptions.size > 0) { // 1 === ws.OPEN
                const payload = {};
                for (const sub of subscriptions) {
                    if (metrics.hasOwnProperty(sub)) {
                        payload[sub] = metrics[sub];
                    }
                }
                if (Object.keys(payload).length > 0) {
                    ws.send(JSON.stringify(payload));
                }
            }
        }
    });

    console.log('WebSocket server initialized with tracking');
    return wss;
}
