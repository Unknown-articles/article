## Turn 1 — Project setup + health endpoint

```
Create a Node.js project using ES Modules (not CommonJS) with Express.

Project requirements:
- Entry point: src/index.js
- Server listens on port 3001 (configurable via PORT env var)
- All JSON responses must set Content-Type: application/json
- Unknown routes must return 404

Implement one endpoint to confirm the server is running:
  GET /health
    200: { status: "ok" }

Deliver the full project structure with all source files.
The server must start and respond to GET /health at the end of this step.
- Use Git for source control (one commit per feature)
```

---

## Turn 2 — CPU and memory collection

```
The server is running. Now implement the metrics collection engine
for CPU and memory — the two most commonly used metric types.

Collection rules:
- Collect metrics once per fixed interval (~1 second) using built-in Node.js
  modules (os, etc.) — do NOT use any third-party metrics library.
- Cache the latest snapshot in memory.
- The cache must be refreshed on every interval tick, never on demand per request.
- All snapshots must include a top-level timestamp (ISO 8601 string).
- Two snapshots collected more than 1 second apart must have different timestamps.

cpu object must contain exactly:
  model:        string
  cores:        number
  idlePercent:  number   (0–100)
  usagePercent: number   (0–100)
  loadAverage:  number[] (array from os.loadavg())

  Note: usagePercent must be computed correctly using the delta between two
  successive os.cpus() readings (idle vs total ticks), not from loadAverage alone.

memory object must contain exactly:
  totalBytes:   number
  freeBytes:    number
  usedBytes:    number         (totalBytes - freeBytes)
  usagePercent: number         (0–100, rounded to 2 decimal places)
  totalMB:      number
  freeMB:       number
  usedMB:       number

Expose these REST endpoints (return the latest cached snapshot — never recompute on request):

  GET /metrics/cpu
    200: { type: "cpu", timestamp: string, data: { ...cpu fields } }

  GET /metrics/memory
    200: { type: "memory", timestamp: string, data: { ...memory fields } }

Keep GET /health and 404 handling working.
```

---

## Turn 3 — Disk and uptime collection

```
CPU and memory collection are working. Now add disk and uptime metrics
to the collection engine.

disk object must contain exactly (when readable):
  totalBytes:   number
  freeBytes:    number
  usedBytes:    number
  usagePercent: number   (0–100)

  On platforms where disk info cannot be read, use { error: string } instead.
  Use the statvfs-equivalent approach available in Node.js (e.g. via a child process
  calling df, or a native binding) — handle the fallback cleanly.

uptime object must contain exactly:
  uptimeSeconds:        number   (> 0, from os.uptime())
  formatted:            string   (human-readable, e.g. "2h 30m 10s")
  processUptimeSeconds: number   (from process.uptime())
  hostname:             string
  platform:             string
  arch:                 string

Add these REST endpoints:

  GET /metrics/disk
    200: { type: "disk", timestamp: string, data: { ...disk fields } }

  GET /metrics/uptime
    200: { type: "uptime", timestamp: string, data: { ...uptime fields } }

The disk and uptime values must come from the shared cached snapshot,
not computed fresh per request.

```

---

## Turn 4 — Unified metrics REST endpoints

```
All four metric types are collected. Now expose the unified REST endpoints
that combine them into a single snapshot and handle type routing.

Implement:

  GET /metrics
    200: {
      timestamp: string,
      cpu:    { ...cpu fields },
      memory: { ...memory fields },
      disk:   { ...disk fields },
      uptime: { ...uptime fields }
    }
    Returns the latest full cached snapshot — never recomputes on request.

  GET /metrics/:type   valid types: "cpu" | "memory" | "disk" | "uptime"
    200: { type: string, timestamp: string, data: <metric object> }
    400: { error: string }   for any type not in the valid list;
         the error message must include the rejected type name.

Rules:
- The four individual endpoints from Turns 2 and 3 (/metrics/cpu, /metrics/memory,
  /metrics/disk, /metrics/uptime) can now be handled by the dynamic /:type route —
  consolidate them if they are not already.
- _sort, _order, and any other query params must not affect the response.
- All data comes from the single shared in-memory cache — no per-request recomputation.

```

---

## Turn 5 — WebSocket server + welcome message

```
The REST API is fully working. Now add a WebSocket server.

WebSocket server setup:
- Attach a WebSocket server to the existing HTTP server (share the same port).
- Accept connections on the path /ws and any sub-path (/ws/cpu, /ws/all, etc.).
- Do not implement path-based auto-subscription yet — that comes in Turn 6.

On every new connection (regardless of path), immediately send a welcome message:
  {
    event:        "connected",
    subscribedTo: [],
    validTypes:   ["all", "cpu", "memory", "disk", "uptime"]
  }

subscribedTo must always be an array (empty for now).
validTypes must always include all five strings listed above.

Handle disconnection cleanly:
- Keep a registry of connected clients.
- Remove a client from the registry immediately when it disconnects.
- No errors or crashes must occur when a client disconnects mid-broadcast.

```

---

## Turn 6 — Path-based auto-subscriptions + immediate snapshot

```
The WebSocket server sends welcome messages. Now implement path-based
auto-subscriptions so clients are subscribed automatically based on the
URL path they connect to.

Path routing rules:
  /ws          → subscribedTo: []              — no immediate snapshot
  /ws/cpu      → subscribedTo: ["cpu"]
  /ws/memory   → subscribedTo: ["memory"]
  /ws/disk     → subscribedTo: ["disk"]
  /ws/uptime   → subscribedTo: ["uptime"]
  /ws/all      → subscribedTo: ["cpu", "memory", "disk", "uptime"]

Update the welcome message to reflect the auto-subscription:
  {
    event:        "connected",
    subscribedTo: <array based on path>,
    validTypes:   ["all", "cpu", "memory", "disk", "uptime"]
  }

After sending the welcome message:
  - If the client connected to a path with auto-subscription (/ws/cpu, /ws/all, etc.),
    immediately send one metric snapshot containing only the subscribed fields:
    {
      timestamp: string,
      cpu?:      object,   ← present only if "cpu" is in subscribedTo
      memory?:   object,
      disk?:     object,
      uptime?:   object
    }
    Never include fields the client is not subscribed to.
  - If the client connected to /ws (no suffix), do NOT send an immediate snapshot.

```

---

## Turn 7 — Broadcast loop

```
Path-based subscriptions and immediate snapshots are working. Now implement
the broadcast loop that pushes metric updates to all connected clients.

Broadcast rules:
- On every collection interval tick, broadcast the latest cached snapshot
  to every connected client that has at least one subscription.
- Each client receives only the fields it is currently subscribed to —
  never leak unsubscribed metrics.
- All clients receive data from the same cached snapshot object —
  the same timestamp must appear in every client's broadcast for a given tick.
- Clients with an empty subscribedTo list (connected to /ws with no subscriptions)
  must NOT receive broadcast snapshots.

Broadcast message format (server → client):
  {
    timestamp: string,   ← ISO 8601, from the shared cached snapshot
    cpu?:      object,
    memory?:   object,
    disk?:     object,
    uptime?:   object
  }

Timing requirement:
- The interval between consecutive broadcast snapshots received by a client
  must be between 500 ms and 2000 ms.

Shared cache requirement:
- REST endpoints and WebSocket broadcasts must read from the same in-memory cache.
- Their timestamps must differ by no more than 2 seconds when fetched at nearly
  the same time.

```

---

## Turn 8 — Dynamic subscribe / unsubscribe messages

```
The broadcast loop is working. Now allow clients to change their subscriptions
at any time by sending messages over the WebSocket connection.

Client → server message format:
  Subscribe:   { "action": "subscribe",   "metrics": ["cpu", "memory"] }
  Unsubscribe: { "action": "unsubscribe", "metrics": ["cpu"] }

On a valid subscribe request:
  1. Add the requested metric types to the client's current subscription set.
  2. Send an ack message:
     {
       event:        "ack",
       action:       "subscribe",
       metrics:      string[],   ← the types that were just added
       subscribedTo: string[]    ← the full updated subscription set
     }
  3. Immediately send one metric snapshot containing only the newly added types
     (not the full subscription set — only what was just subscribed in this request).

On a valid unsubscribe request:
  1. Remove the requested metric types from the client's subscription set.
  2. Send an ack message:
     {
       event:        "ack",
       action:       "unsubscribe",
       metrics:      string[],   ← the types that were just removed
       subscribedTo: string[]    ← the full updated subscription set
     }
  (No immediate snapshot is sent after unsubscribe.)

Special case — "all" in a subscribe request:
  Expand "all" to all four individual types: ["cpu", "memory", "disk", "uptime"].
  Store and report the expanded list, not the literal string "all".

```

---

## Turn 9 — WebSocket error handling

```
Dynamic subscriptions are working. Now add comprehensive error handling
for all invalid client messages.

Error message format (server → client):
  { event: "error", message: string }

Send an error message (do NOT close the connection) for each of these cases:

1. Invalid JSON:
   - The client sends a message that cannot be parsed as JSON.
   - Error message must indicate the input was not valid JSON.

2. Unknown action:
   - The parsed message has an "action" field that is not "subscribe" or "unsubscribe".
   - Error message must indicate the action is unknown or not supported.

3. Missing action:
   - The parsed message has no "action" field at all.
   - Treat the same as unknown action.

4. Unknown metric type:
   - The "metrics" array contains a type string that is not one of:
     "cpu", "memory", "disk", "uptime", "all"
   - Error message must name the unknown type (e.g. "Unknown metric type: 'xyz'").
   - If multiple unknown types are present, report each one or report them together —
     either approach is acceptable.

5. Empty metrics array:
   - The "metrics" field is present but is an empty array [].
   - Error message must indicate that at least one metric type is required.

6. Missing metrics field:
   - The parsed message has a valid action but no "metrics" field.
   - Treat the same as an empty metrics array.

After sending an error message, the client's subscription set must remain unchanged.
The connection must stay open so the client can send corrected messages.

```

---

## Turn 10 — Concurrency audit + final review

```
All features are implemented. Do a full concurrency and correctness audit,
then deliver the final project.

Concurrency checks:
1. Confirm metrics are collected exactly once per interval — not once per connected
   client and not once per REST request.
2. Confirm two clients connected simultaneously to /ws/all receive broadcasts with
   identical timestamps — proving a single shared cache, not per-client polling.
3. Confirm the interval between consecutive broadcast snapshots is between 500 ms
   and 2000 ms under normal load.
4. Confirm disconnected clients are removed from the registry immediately, so the
   broadcast loop never attempts to write to a closed socket.
5. Confirm no synchronous blocking operations exist in the collection or broadcast path.

REST API audit:
6. Confirm GET /health returns 200: { status: "ok" }.
7. Confirm GET /metrics returns a full snapshot with timestamp, cpu, memory, disk, uptime.
8. Confirm GET /metrics/cpu returns { type: "cpu", timestamp: string, data: { ...cpu fields } }.
9. Confirm the cpu object contains exactly: model, cores, idlePercent, usagePercent, loadAverage.
10. Confirm the memory object contains exactly: totalBytes, freeBytes, usedBytes,
    usagePercent, totalMB, freeMB, usedMB.
11. Confirm the uptime object contains exactly: uptimeSeconds, formatted,
    processUptimeSeconds, hostname, platform, arch.
12. Confirm GET /metrics/<invalid> returns 400 with an error message that includes
    the rejected type name.
13. Confirm unknown HTTP routes return 404.

WebSocket audit:
14. Confirm connecting to /ws sends a welcome with subscribedTo: [] and no immediate snapshot.
15. Confirm connecting to /ws/all sends a welcome with subscribedTo containing all 4 types,
    followed immediately by a full snapshot.
16. Confirm connecting to /ws/cpu sends a welcome with subscribedTo: ["cpu"],
    followed immediately by a snapshot containing only the cpu field.
17. Confirm subscribe ack includes the correct updated subscribedTo list.
18. Confirm unsubscribe ack includes the correct updated subscribedTo list.
19. Confirm invalid JSON returns { event: "error", message: string }.
20. Confirm unknown action returns { event: "error", message: string }.
21. Confirm unknown metric type returns an error message that names the unknown type.
22. Confirm empty metrics array returns { event: "error", message: string }.
23. Confirm the connection stays open after any error message.

Deliver the complete final project structure with all source files.
```