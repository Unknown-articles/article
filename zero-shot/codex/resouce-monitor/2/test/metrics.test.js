import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MetricsStore } from "../src/metrics.js";

async function createReadyApp(intervalMs = 100) {
  const metricsStore = new MetricsStore({ intervalMs });
  await metricsStore.start();
  const app = createApp({ metricsStore });

  return {
    app,
    metricsStore,
  };
}

test("GET /metrics returns cached system snapshot with expected shape", async () => {
  const { app, metricsStore } = await createReadyApp();

  try {
    const response = await request(app).get("/metrics");

    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"]?.includes("application/json"), true);
    assert.ok(Number.isFinite(Date.parse(response.body.timestamp)));
    assert.deepEqual(Object.keys(response.body.cpu), [
      "model",
      "cores",
      "idlePercent",
      "usagePercent",
      "loadAverage",
    ]);
    assert.deepEqual(Object.keys(response.body.memory), [
      "totalBytes",
      "freeBytes",
      "usedBytes",
      "usagePercent",
      "totalMB",
      "freeMB",
      "usedMB",
    ]);
    assert.deepEqual(Object.keys(response.body.uptime), [
      "uptimeSeconds",
      "formatted",
      "processUptimeSeconds",
      "hostname",
      "platform",
      "arch",
    ]);
    assert.equal(typeof response.body.cpu.model, "string");
    assert.equal(typeof response.body.cpu.cores, "number");
    assert.equal(Array.isArray(response.body.cpu.loadAverage), true);
    assert.equal(response.body.memory.totalBytes > 0, true);
    assert.equal(response.body.uptime.uptimeSeconds > 0, true);
    assert.equal(typeof response.body.uptime.formatted, "string");

    if ("error" in response.body.disk) {
      assert.deepEqual(Object.keys(response.body.disk), ["error"]);
      assert.equal(typeof response.body.disk.error, "string");
    } else {
      assert.deepEqual(Object.keys(response.body.disk), [
        "totalBytes",
        "freeBytes",
        "usedBytes",
        "usagePercent",
      ]);
    }
  } finally {
    metricsStore.stop();
  }
});

test("GET /metrics/:type returns metric data and rejects invalid types", async () => {
  const { app, metricsStore } = await createReadyApp();

  try {
    const cpuResponse = await request(app).get("/metrics/cpu");
    const invalidResponse = await request(app).get("/metrics/network");

    assert.equal(cpuResponse.status, 200);
    assert.deepEqual(Object.keys(cpuResponse.body), ["type", "timestamp", "data"]);
    assert.equal(cpuResponse.body.type, "cpu");
    assert.ok(Number.isFinite(Date.parse(cpuResponse.body.timestamp)));
    assert.deepEqual(Object.keys(cpuResponse.body.data), [
      "model",
      "cores",
      "idlePercent",
      "usagePercent",
      "loadAverage",
    ]);

    assert.equal(invalidResponse.status, 400);
    assert.equal(typeof invalidResponse.body.error, "string");
    assert.equal(invalidResponse.body.error.includes("network"), true);
  } finally {
    metricsStore.stop();
  }
});

test("GET /metrics reuses cached snapshots between requests until refresh", async () => {
  const { app, metricsStore } = await createReadyApp(200);

  try {
    const firstResponse = await request(app).get("/metrics");
    const secondResponse = await request(app).get("/metrics");

    assert.equal(firstResponse.body.timestamp, secondResponse.body.timestamp);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const thirdResponse = await request(app).get("/metrics");
    assert.notEqual(firstResponse.body.timestamp, thirdResponse.body.timestamp);
  } finally {
    metricsStore.stop();
  }
});
