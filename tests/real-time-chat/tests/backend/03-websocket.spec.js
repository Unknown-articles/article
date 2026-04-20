/**
 * Backend Suite 3 – WebSocket
 * Covers connection rejection (4001/4002), successful connection, history event,
 * message send/receive, and broadcast to multiple clients.
 *
 * Uses Node.js 22+ built-in global WebSocket (no extra dependency needed).
 */

const { test, expect } = require('@playwright/test');
const {
  BACKEND_URL,
  WS_URL,
  uniqueUser,
  apiRegister,
  apiLogin,
  openWebSocket,
  waitForMessages,
  awaitClose,
} = require('../helpers');

const PASSWORD = 'secret123';

test.describe('WebSocket', () => {
  // ─── Connection rejection ──────────────────────────────────────────────────

  test('connecting without a token closes with code 4001', async () => {
    const { code } = await awaitClose(WS_URL);
    expect(code).toBe(4001);
  });

  test('connecting with an invalid token closes with code 4002', async () => {
    const { code } = await awaitClose(`${WS_URL}?token=not.a.valid.jwt`);
    expect(code).toBe(4002);
  });

  // ─── Successful connection ─────────────────────────────────────────────────

  test('connecting with a valid token stays open (does not close immediately)', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws } = await openWebSocket(token);

    // Give it 1 second — connection should still be open
    await new Promise(r => setTimeout(r, 1000));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
  });

  // ─── History event ────────────────────────────────────────────────────────

  test('first message after connect has type "history"', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws, messages } = await openWebSocket(token);
    await waitForMessages(messages, 1);

    expect(messages[0].type).toBe('history');

    ws.close();
  });

  test('history event has a messages array', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws, messages } = await openWebSocket(token);
    await waitForMessages(messages, 1);

    expect(Array.isArray(messages[0].messages)).toBe(true);

    ws.close();
  });

  // ─── Send and receive ─────────────────────────────────────────────────────

  test('sending a message echoes back a "message" event to the sender', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws, messages } = await openWebSocket(token);
    // Wait for history first
    await waitForMessages(messages, 1);

    const content = `ws_test_${Date.now()}`;
    ws.send(JSON.stringify({ type: 'message', content }));

    // Wait until a message with our content arrives (other tests broadcast concurrently)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for own message')), 5000);
      const check = setInterval(() => {
        if (messages.some(m => m.type === 'message' && m.content === content)) {
          clearInterval(check);
          clearTimeout(timer);
          resolve();
        }
      }, 50);
    });

    const msg = messages.find(m => m.type === 'message' && m.content === content);
    expect(msg).toBeTruthy();
    expect(msg.content).toBe(content);

    ws.close();
  });

  test('message event contains id, userId, username, content, and timestamp', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws, messages } = await openWebSocket(token);
    await waitForMessages(messages, 1);

    ws.send(JSON.stringify({ type: 'message', content: `fields_${Date.now()}` }));
    await waitForMessages(messages, 2);

    const msg = messages.find(m => m.type === 'message');
    expect(typeof msg.id).toBe('number');
    expect(msg.id).toBeGreaterThan(0);
    expect(typeof msg.userId).toBe('number');
    expect(msg.username).toBe(username);
    expect(typeof msg.content).toBe('string');
    expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    ws.close();
  });

  test('message id is numeric and positive', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    const { ws, messages } = await openWebSocket(token);
    await waitForMessages(messages, 1);

    ws.send(JSON.stringify({ type: 'message', content: `id_test_${Date.now()}` }));
    await waitForMessages(messages, 2);

    const msg = messages.find(m => m.type === 'message');
    expect(Number.isInteger(msg.id)).toBe(true);
    expect(msg.id).toBeGreaterThan(0);

    ws.close();
  });

  // ─── Broadcast ────────────────────────────────────────────────────────────

  test('message sent by user1 is broadcast to user2', async () => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    const { token: token1 } = await apiRegister(user1, PASSWORD);
    const { token: token2 } = await apiRegister(user2, PASSWORD);

    const client1 = await openWebSocket(token1);
    const client2 = await openWebSocket(token2);

    // Both must receive history first
    await waitForMessages(client1.messages, 1);
    await waitForMessages(client2.messages, 1);

    const content = `broadcast_${Date.now()}`;
    client1.ws.send(JSON.stringify({ type: 'message', content }));

    // client2 should receive the message event
    await waitForMessages(client2.messages, 2);

    const received = client2.messages.find(m => m.type === 'message' && m.content === content);
    expect(received).toBeTruthy();
    expect(received.username).toBe(user1);

    client1.ws.close();
    client2.ws.close();
  });

  test('broadcast message username matches the sender, not the receiver', async () => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    const { token: token1 } = await apiRegister(user1, PASSWORD);
    const { token: token2 } = await apiRegister(user2, PASSWORD);

    const client1 = await openWebSocket(token1);
    const client2 = await openWebSocket(token2);

    await waitForMessages(client1.messages, 1);
    await waitForMessages(client2.messages, 1);

    const content = `sender_check_${Date.now()}`;
    client1.ws.send(JSON.stringify({ type: 'message', content }));

    await waitForMessages(client2.messages, 2);

    const received = client2.messages.find(m => m.type === 'message' && m.content === content);
    expect(received.username).toBe(user1);
    expect(received.username).not.toBe(user2);

    client1.ws.close();
    client2.ws.close();
  });

  // ─── History contents ─────────────────────────────────────────────────────

  test('history messages array contains previously sent messages', async () => {
    const username = uniqueUser();
    const { token } = await apiRegister(username, PASSWORD);

    // First connection: send a message
    const client1 = await openWebSocket(token);
    await waitForMessages(client1.messages, 1);
    const content = `history_check_${Date.now()}`;
    client1.ws.send(JSON.stringify({ type: 'message', content }));
    await waitForMessages(client1.messages, 2);
    client1.ws.close();

    // Small delay to ensure DB write
    await new Promise(r => setTimeout(r, 300));

    // Second connection: history should include that message
    const client2 = await openWebSocket(token);
    await waitForMessages(client2.messages, 1);

    const history = client2.messages[0];
    const found = history.messages.some(m => m.content === content);
    expect(found).toBe(true);

    client2.ws.close();
  });
});
