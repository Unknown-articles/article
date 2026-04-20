# Resource Monitor API

A Node.js API for monitoring system resources with REST and WebSocket support.

## Features

- Collects CPU, memory, and uptime metrics every second
- REST API for getting latest metrics
- WebSocket for real-time streaming with dynamic subscriptions

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

## API

### REST

- `GET /metrics` - Get all metrics
- `GET /metrics/:type` - Get specific metric (cpu, memory, uptime)

### WebSocket

Connect to `ws://localhost:3000`

Send JSON messages for subscriptions:

Subscribe:
```json
{
  "action": "subscribe",
  "metrics": ["cpu", "memory"]
}
```

Unsubscribe:
```json
{
  "action": "unsubscribe",
  "metrics": ["cpu"]
}
```

## Project Structure

- `server.js` - Main server file
- `routes/metrics.js` - REST routes
- `services/metricsService.js` - Metrics collection service
- `websocket/handlers.js` - WebSocket connection handlers