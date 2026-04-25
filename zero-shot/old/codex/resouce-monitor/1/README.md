# Resource Monitor API

Node.js Resource Monitor API built with Express and WebSocket.

## Features

- Shared in-memory metrics collection every second
- REST snapshots for all metrics and specific metric types
- Modular architecture for routes, services, and WebSocket handlers
- WebSocket streaming with path-based defaults and dynamic subscriptions
- Heartbeat-based stale client cleanup and graceful shutdown handling

## Run

```bash
npm install
npm start
```

The API listens on `http://localhost:3002`.

## REST API

- `GET /health`
- `GET /metrics`
- `GET /metrics/:type`

Supported metric types: `cpu`, `memory`, `disk`, `uptime`

## WebSocket Streams

- `ws://localhost:3002/ws/cpu`
- `ws://localhost:3002/ws/memory`
- `ws://localhost:3002/ws/all`

Clients can update subscriptions dynamically:

```json
{
  "action": "subscribe",
  "metrics": ["cpu", "memory"]
}
```

To unsubscribe:

```json
{
  "action": "unsubscribe",
  "metrics": ["memory"]
}
```

## Project Structure

```text
resource-monitor/
|-- package.json
|-- src/
|   |-- app.js
|   |-- config.js
|   |-- server.js
|   |-- routes/
|   |   `-- metricsRoutes.js
|   |-- services/
|   |   |-- diskService.js
|   |   `-- metricsService.js
|   `-- websocket/
|       |-- messageHandlers.js
|       |-- server.js
|       `-- subscriptions.js
`-- README.md
```
