# Resource Monitor API

A Node.js API for monitoring system resources using Express and WebSocket.

## Features

- REST API for fetching metrics snapshots
- WebSocket for real-time streaming
- Collects CPU, memory, disk, and uptime metrics

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

Server listens on port 3000 (or PORT env var)

## Endpoints

### REST

- GET /health
- GET /metrics
- GET /metrics/:type (cpu, memory, disk, uptime)

### WebSocket

- /ws
- /ws/cpu
- /ws/memory
- /ws/disk
- /ws/uptime
- /ws/all

For WebSocket protocol, see the code or spec.