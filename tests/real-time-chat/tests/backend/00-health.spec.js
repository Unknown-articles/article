/**
 * Backend Suite 0 – Health & CORS
 * Verifies the GET /health endpoint and that CORS is correctly configured
 * to accept requests from the frontend origin (http://localhost:5173).
 */

const { test, expect } = require('@playwright/test');
const { BACKEND_URL, FRONTEND_URL } = require('../helpers');

test.describe('Health', () => {
  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    expect(res.status()).toBe(200);
  });

  test('GET /health body has status: "ok"', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /health body has an ISO 8601 timestamp', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    const body = await res.json();
    expect(body.timestamp).toBeTruthy();
    // ISO 8601: YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SSZ
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

test.describe('CORS', () => {
  test('backend allows requests from the frontend origin', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`, {
      headers: { Origin: FRONTEND_URL },
    });
    const corsHeader = res.headers()['access-control-allow-origin'];
    expect(corsHeader).toBe(FRONTEND_URL);
  });

  test('CORS preflight for /auth/register is accepted from frontend origin', async ({ request }) => {
    const res = await request.fetch(`${BACKEND_URL}/auth/register`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    // Preflight must succeed (200 or 204)
    expect(res.status()).toBeLessThan(300);
    const corsHeader = res.headers()['access-control-allow-origin'];
    expect(corsHeader).toBe(FRONTEND_URL);
  });
});
