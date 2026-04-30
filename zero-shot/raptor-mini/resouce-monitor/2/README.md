# Resource Monitor API

Node.js Resource Monitor API with Express REST endpoints and WebSocket streaming.

## Features

- Periodic OS metric collection once per interval
- Cached snapshot shared across all clients
- REST endpoints for metrics and health
- WebSocket endpoints for dynamic subscriptions
- Auto-subscribe streams: `/ws/cpu`, `/ws/memory`, `/ws/disk`, `/ws/uptime`, `/ws/all`

## Run

```bash
npm install
npm start
```

## API

- `GET /health`
- `GET /metrics`
- `GET /metrics/:type`
- WebSocket paths: `/ws`, `/ws/cpu`, `/ws/memory`, `/ws/disk`, `/ws/uptime`, `/ws/all`

## WebSocket protocol

- `connected`, `ack`, `error` events
- Client messages: `{ action: "subscribe", metrics: ["cpu", "memory"] }`
- Broadcast snapshots include only subscribed metrics
