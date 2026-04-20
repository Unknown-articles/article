Create a Resource Monitor API using:

- JavaScript (Node.js, ES Modules)
- Express framework for REST endpoints
- WebSocket for real-time communication

GENERAL REQUIREMENTS

- The system must collect operating system metrics (CPU, memory, etc.).
- Metrics must be collected once per interval and shared across all subscribers.

FEATURES

System Metrics Collection

- Collect OS metrics such as:
    - CPU usage
    - Memory usage
    - Disc usage
    - Uptime
- Use built-in Node.js modules (e.g., os)
- Metrics must be collected at a fixed interval (e.g., every 1 second)
- Data must be cached in memory and reused for all clients

WebSocket Server

- Implement a WebSocket server for real-time updates
- Clients must be able to connect and receive streaming data

Streaming Endpoint Types

- Support different types of streams, such as:
    - /ws/cpu
    - /ws/memory
    - /ws/all
- Each stream should send only relevant data

Dynamic Subscriptions

- Allow clients to subscribe/unsubscribe dynamically
- A client can subscribe to multiple metric types
- Subscription messages example:
{
"action": "subscribe",
"metrics": ["cpu", "memory"]
}

Broadcast Model

- Metrics must be collected once per interval
- Broadcast the same data to all subscribed clients
- Avoid per-client polling or redundant computation

REST API

- Provide endpoints to fetch latest metrics snapshot:
    - GET /metrics
    - GET /metrics/:type

Concurrency and Performance

- Ensure efficient handling of multiple WebSocket clients
- Avoid blocking operations

Error Handling

- Handle invalid subscription requests
- Handle disconnected clients gracefully

TESTABILITY

Server

- Server must listen on port 3000 (configurable via PORT env var)
- All JSON responses must set Content-Type: application/json
- Unknown routes must return 404

REST API — Exact Response Contracts

  GET /health
    200: { status: "ok" }

  GET /metrics
    200: {
      timestamp: string,   ← ISO 8601, changes every collection interval
      cpu:    { ... },
      memory: { ... },
      disk:   { ... },
      uptime: { ... }
    }

  GET /metrics/:type        valid types: "cpu" | "memory" | "disk" | "uptime"
    200: { type: string, timestamp: string, data: <metric object> }
    400: { error: string }  ← for any type not in the valid list; error message must include the rejected type name

  GET /metrics/anything-invalid
    400: { error: string }

REST API — Metric Field Shapes

  cpu object must contain exactly:
    model:        string
    cores:        number
    idlePercent:  number    (0–100)
    usagePercent: number    (0–100)
    loadAverage:  number[]  (array)

  memory object must contain exactly:
    totalBytes:   number  (> 0)
    freeBytes:    number
    usedBytes:    number
    usagePercent: number  (0–100)
    totalMB:      number
    freeMB:       number
    usedMB:       number

  disk object must contain exactly (when available):
    totalBytes:   number
    freeBytes:    number
    usedBytes:    number
    usagePercent: number
  On platforms where disk info cannot be read, include { error: string } instead.

  uptime object must contain exactly:
    uptimeSeconds:        number  (> 0)
    formatted:            string  (human-readable uptime)
    processUptimeSeconds: number
    hostname:             string
    platform:             string
    arch:                 string

Timestamps

- All timestamps in REST and WebSocket messages must be ISO 8601 strings parseable by new Date()
- Two calls to GET /metrics separated by > 1 second must return different timestamps
  (metrics are refreshed every collection interval, not per-request)
- REST and WebSocket snapshots share the same cached data — their timestamps must differ
  by no more than 2 seconds when fetched close together

WebSocket Protocol — Endpoints

  /ws          base endpoint, no automatic subscription
  /ws/cpu      connects and auto-subscribes to "cpu"
  /ws/memory   connects and auto-subscribes to "memory"
  /ws/disk     connects and auto-subscribes to "disk"
  /ws/uptime   connects and auto-subscribes to "uptime"
  /ws/all      connects and auto-subscribes to all metric types

WebSocket Protocol — Message Types (Server → Client)

  Welcome (sent immediately on connection):
    {
      event:       "connected",
      subscribedTo: string[],   ← empty [] when connecting to /ws; populated for path subscriptions
      validTypes:  string[]     ← must include: "all", "cpu", "memory", "disk", "uptime"
    }

  Acknowledgement (sent after subscribe/unsubscribe):
    {
      event:       "ack",
      action:      "subscribe" | "unsubscribe",
      metrics:     string[],    ← the metrics that were changed
      subscribedTo: string[]    ← full list after the change
    }

  Metric snapshot (broadcast on every interval to subscribed clients):
    {
      timestamp: string,        ← ISO 8601
      cpu?:      object,        ← present only if client subscribed to "cpu" or "all"
      memory?:   object,        ← present only if client subscribed to "memory" or "all"
      disk?:     object,        ← present only if client subscribed to "disk" or "all"
      uptime?:   object         ← present only if client subscribed to "uptime" or "all"
    }
    Snapshots must ONLY include fields the client is subscribed to — no leaking of unsubscribed metrics.

  Error:
    {
      event:   "error",
      message: string
    }
    Must be sent for:
    - invalid JSON received from client
    - unknown action (anything other than "subscribe" / "unsubscribe")
    - unknown metric type in the metrics array (error message must name the unknown type)
    - empty metrics array in a subscribe/unsubscribe request

WebSocket Protocol — Client → Server Messages

  Subscribe:   { action: "subscribe",   metrics: string[] }
  Unsubscribe: { action: "unsubscribe", metrics: string[] }

  After a successful subscribe, the server must send:
    1. An ack message
    2. An immediate metric snapshot for the newly subscribed types

Path-Based Subscriptions (auto-subscribe on connect)

  - Connecting to /ws/cpu must set subscribedTo: ["cpu"] in the welcome message
    and send an immediate snapshot containing only the cpu field
  - Same rule applies for /ws/memory, /ws/disk, /ws/uptime
  - Connecting to /ws/all must set subscribedTo with all metric types
    and send an immediate full snapshot (cpu + memory + disk + uptime)
  - Connecting to /ws (no suffix) must set subscribedTo: []
    and NOT send an immediate snapshot

Broadcast Behaviour

- Metrics must be collected once per interval (~1 second) and the same snapshot
  shared with all connected subscribers
- Two clients connected simultaneously to /ws/all must receive identical snapshots
  (same timestamp) — this proves a single cache, not per-client polling
- The interval between consecutive broadcast snapshots must be between 500 ms and 2000 ms
- When a client disconnects, it must be removed cleanly so remaining clients
  continue to receive broadcasts unaffected

DEVELOPMENT PROCESS

- Implement each feature incrementally
- Each feature must correspond to a separate Git commit
- Each step must result in a working system

OUTPUT

- Provide full project structure