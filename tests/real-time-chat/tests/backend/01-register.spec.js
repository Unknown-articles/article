/**
 * Backend Suite 1 – Registration
 * Covers POST /auth/register: success, validation errors, and duplicate usernames.
 */

const { test, expect } = require('@playwright/test');
const { BACKEND_URL, uniqueUser } = require('../helpers');

const PASSWORD = 'secret123';

test.describe('POST /auth/register', () => {
  test('returns 201 with token, userId, and username on success', async ({ request }) => {
    const username = uniqueUser();
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.userId).toBe('number');
    expect(body.username).toBe(username);
  });

  test('returns 400 when username is missing', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { password: PASSWORD },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 when password is missing', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username: uniqueUser() },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 when username is shorter than 3 characters', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username: 'ab', password: PASSWORD },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 when password is shorter than 6 characters', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username: uniqueUser(), password: '123' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 409 for duplicate username', async ({ request }) => {
    const username = uniqueUser();
    // First registration succeeds
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    // Second registration with same username must conflict
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    expect(res.status()).toBe(409);
  });

  test('409 response body contains an error message about the name being taken', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    const body = await res.json();
    expect(body.error).toMatch(/taken|already/i);
  });

  test('registered user can log in immediately after registration', async ({ request }) => {
    const username = uniqueUser();
    await request.post(`${BACKEND_URL}/auth/register`, {
      data: { username, password: PASSWORD },
    });
    const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { username, password: PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
  });
});
