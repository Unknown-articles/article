# Resource Monitor API

Node.js + Express + WebSocket resource monitor.

## Features

- Collects OS metrics once per interval
- Shares cached metrics across REST and WebSocket clients
- Supports dynamic subscription over WebSocket
- Endpoints:
  - `GET /health`
  - `GET /metrics`
  - `GET /metrics/:type`
  - WebSocket `/ws`, `/ws/cpu`, `/ws/memory`, `/ws/disk`, `/ws/uptime`, `/ws/all`

## Run

```bash
npm install
npm start
```

Server listens on `PORT` or `3000`.
