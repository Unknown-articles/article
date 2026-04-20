import WebSocket from 'ws';

const cases = [
  '/ws',
  '/ws/cpu',
  '/ws/all',
  '/ws/invalid',
];

async function testPath(path) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:3000${path}`);
    const messages = [];
    ws.on('message', (msg) => messages.push(msg.toString()));
    ws.on('open', () => {});
    ws.on('close', () => {
      console.log(path, messages.length, JSON.stringify(messages));
      resolve();
    });
    ws.on('error', reject);
    setTimeout(() => ws.close(), 500);
  });
}

(async () => {
  for (const path of cases) {
    await testPath(path);
  }
})();
