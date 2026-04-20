import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createResourceMonitorServer } from "../src/create-server.js";

function onceOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
}

function onceMessage(socket) {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}

function createClient(port, path) {
  return new WebSocket(`ws://127.0.0.1:${port}${path}`);
}

test("path-based websocket subscriptions send welcome and filtered snapshot", async () => {
  const resourceMonitor = await createResourceMonitorServer({ intervalMs: 150 });
  const address = await resourceMonitor.listen(0);
  const socket = createClient(address.port, "/ws/cpu");

  try {
    await onceOpen(socket);
    const welcome = await onceMessage(socket);
    const snapshot = await onceMessage(socket);

    assert.deepEqual(welcome, {
      event: "connected",
      subscribedTo: ["cpu"],
      validTypes: ["all", "cpu", "memory", "disk", "uptime"],
    });
    assert.ok(Number.isFinite(Date.parse(snapshot.timestamp)));
    assert.equal("cpu" in snapshot, true);
    assert.equal("memory" in snapshot, false);
    assert.equal("disk" in snapshot, false);
    assert.equal("uptime" in snapshot, false);
  } finally {
    socket.close();
    await resourceMonitor.close();
  }
});

test("base websocket supports dynamic subscribe and unsubscribe", async () => {
  const resourceMonitor = await createResourceMonitorServer({ intervalMs: 150 });
  const address = await resourceMonitor.listen(0);
  const socket = createClient(address.port, "/ws");

  try {
    await onceOpen(socket);
    const welcome = await onceMessage(socket);

    assert.deepEqual(welcome, {
      event: "connected",
      subscribedTo: [],
      validTypes: ["all", "cpu", "memory", "disk", "uptime"],
    });

    socket.send(JSON.stringify({ action: "subscribe", metrics: ["cpu", "memory"] }));
    const ack = await onceMessage(socket);
    const snapshot = await onceMessage(socket);

    assert.deepEqual(ack, {
      event: "ack",
      action: "subscribe",
      metrics: ["cpu", "memory"],
      subscribedTo: ["cpu", "memory"],
    });
    assert.equal("cpu" in snapshot, true);
    assert.equal("memory" in snapshot, true);
    assert.equal("disk" in snapshot, false);

    socket.send(JSON.stringify({ action: "unsubscribe", metrics: ["cpu"] }));
    const unsubscribeAck = await onceMessage(socket);

    assert.deepEqual(unsubscribeAck, {
      event: "ack",
      action: "unsubscribe",
      metrics: ["cpu"],
      subscribedTo: ["memory"],
    });
  } finally {
    socket.close();
    await resourceMonitor.close();
  }
});

test("websocket reports protocol errors and shares cached broadcasts", async () => {
  const resourceMonitor = await createResourceMonitorServer({ intervalMs: 150 });
  const address = await resourceMonitor.listen(0);
  const firstClient = createClient(address.port, "/ws/all");
  const secondClient = createClient(address.port, "/ws/all");

  try {
    await Promise.all([onceOpen(firstClient), onceOpen(secondClient)]);

    await onceMessage(firstClient);
    await onceMessage(secondClient);
    await onceMessage(firstClient);
    await onceMessage(secondClient);

    const firstBroadcastPromise = onceMessage(firstClient);
    const secondBroadcastPromise = onceMessage(secondClient);
    const [firstBroadcast, secondBroadcast] = await Promise.all([
      firstBroadcastPromise,
      secondBroadcastPromise,
    ]);

    assert.equal(firstBroadcast.timestamp, secondBroadcast.timestamp);
    assert.deepEqual(Object.keys(firstBroadcast).sort(), [
      "cpu",
      "disk",
      "memory",
      "timestamp",
      "uptime",
    ]);

    firstClient.send("{broken");
    const invalidJsonError = await onceMessage(firstClient);
    assert.deepEqual(invalidJsonError, {
      event: "error",
      message: "Invalid JSON received from client",
    });

    firstClient.send(JSON.stringify({ action: "watch", metrics: ["cpu"] }));
    const invalidActionError = await onceMessage(firstClient);
    assert.equal(invalidActionError.event, "error");
    assert.equal(invalidActionError.message.includes("watch"), true);

    firstClient.send(JSON.stringify({ action: "subscribe", metrics: ["network"] }));
    const invalidMetricError = await onceMessage(firstClient);
    assert.equal(invalidMetricError.event, "error");
    assert.equal(invalidMetricError.message.includes("network"), true);

    firstClient.send(JSON.stringify({ action: "subscribe", metrics: [] }));
    const emptyMetricsError = await onceMessage(firstClient);
    assert.deepEqual(emptyMetricsError, {
      event: "error",
      message: "metrics array must not be empty",
    });
  } finally {
    firstClient.close();
    secondClient.close();
    await resourceMonitor.close();
  }
});
