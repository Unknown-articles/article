# Resource Monitor API

A Node.js API for monitoring system resources using Express and WebSocket.

## Features

- Collects OS metrics (CPU, memory, disk, uptime) every second
- REST API for fetching metrics snapshots
- WebSocket server for real-time streaming
- Dynamic subscriptions for WebSocket clients

## Installation

1. Clone or download the project
2. Run `npm install` to install dependencies

## Running

```bash
npm start
```

The server will listen on port 3000 (configurable via PORT environment variable).

## API Endpoints

### REST API

- `GET /health` - Health check
- `GET /metrics` - All metrics
- `GET /metrics/:type` - Specific metric (cpu, memory, disk, uptime)

### WebSocket

- `/ws` - Base endpoint
- `/ws/cpu` - Auto-subscribe to CPU
- `/ws/memory` - Auto-subscribe to memory
- `/ws/disk` - Auto-subscribe to disk
- `/ws/uptime` - Auto-subscribe to uptime
- `/ws/all` - Auto-subscribe to all

## Usage

### REST

```bash
curl http://localhost:3000/metrics
```

### WebSocket

Connect to `ws://localhost:3000/ws/all` and receive real-time updates.

## Dependencies

- express
- ws