# Resource Monitor API

A Node.js ES module REST and WebSocket API for streaming operating system metrics.

## Features

- Collects CPU, memory, disk, and uptime metrics every 1 second
- Caches metrics in memory and shares the same snapshot across all clients
- REST endpoints for latest snapshots
- WebSocket endpoints for dynamic subscriptions and real-time broadcasts

## Run

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

The server listens on port `3001` by default and can be overridden with `PORT`.
