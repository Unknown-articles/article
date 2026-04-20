/**
 * Backend Suite 2 – Login
 * Covers POST /auth/login: success, missing fields, wrong password, unknown user.
 */

const { test, expect } = require('@playwright/test');
const { BACKEND_URL, uniqueUser } = require('../helpers');

const PASSWORD = 'secret123';

test.describe('POST /auth/login', () => {
  test('returns 200 with token, userId, and username on valid credentials', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });

    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username, password: PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.userId).toBe('number');
    expect(body.username).toBe(username);
  });

  test('token is a non-empty string of reasonable length', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username, password: PASSWORD },
    });
    const { token } = await res.json();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  test('returns 400 when username is missing', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { password: PASSWORD },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 when password is missing', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username: uniqueUser() },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 401 for wrong password', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });

    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
  });

  test('401 response body contains an error field', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username, password: 'wrongpassword' },
    });
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body.error).toMatch(/invalid/i);
  });

  test('returns 401 for non-existent username', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username: 'doesnotexist_xyz_' + Date.now(), password: PASSWORD },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });
});
