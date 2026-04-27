# Resource Monitor API

A Node.js API for monitoring system resources using Express for REST endpoints and WebSocket for real-time updates.

## Features

- Collects OS metrics: CPU, memory, disk, uptime
- REST API for fetching metrics snapshots
- WebSocket server for real-time streaming
- Supports dynamic subscriptions

## Installation

1. Clone or download the project
2. Run `npm install` to install dependencies

## Running the Server

```bash
npm start
```

The server listens on port 3001 by default, or set `PORT` environment variable.

## REST API

### GET /health
Returns server health status.

Response: `{ "status": "ok" }`

### GET /metrics
Returns the latest metrics snapshot.

Response:
```json
{
  "timestamp": "ISO 8601 string",
  "cpu": { ... },
  "memory": { ... },
  "disk": { ... },
  "uptime": { ... }
}
```

### GET /metrics/:type
Returns specific metric data. Valid types: `cpu`, `memory`, `disk`, `uptime`

Response:
```json
{
  "type": "cpu",
  "timestamp": "ISO 8601 string",
  "data": { ... }
}
```

## WebSocket

Connect to `ws://localhost:3001/ws` for base endpoint.

Endpoints:
- `/ws` - No auto-subscription
- `/ws/cpu` - Auto-subscribe to CPU
- `/ws/memory` - Auto-subscribe to memory
- `/ws/disk` - Auto-subscribe to disk
- `/ws/uptime` - Auto-subscribe to uptime
- `/ws/all` - Auto-subscribe to all

### Messages

#### Client to Server
Subscribe: `{ "action": "subscribe", "metrics": ["cpu", "memory"] }`
Unsubscribe: `{ "action": "unsubscribe", "metrics": ["cpu"] }`

#### Server to Client
Welcome: `{ "event": "connected", "subscribedTo": [...], "validTypes": [...] }`
Ack: `{ "event": "ack", "action": "subscribe", "metrics": [...], "subscribedTo": [...] }`
Snapshot: `{ "timestamp": "...", "cpu": {...}, ... }` (only subscribed metrics)
Error: `{ "event": "error", "message": "..." }`

## Project Structure

- `server.js` - Main server file
- `metrics.js` - Metrics collection functions
- `package.json` - Dependencies and scripts