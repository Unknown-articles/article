import WebSocket from 'ws';

const cases = [
  '/ws',
  '/ws/all',
  '/ws/uptime',
  '/ws/invalid',
];

async function probeWebSocket(path) {
  return new Promise((resolve, reject) => {
    const connection = new WebSocket(`ws://127.0.0.1:3000${path}`);
    const result = [];
    connection.on('message', (msg) => result.push(msg.toString()));
    connection.on('open', () => {});
    connection.on('close', () => {
      console.log(path, result.length, JSON.stringify(result));
      resolve();
    });
    connection.on('error', reject);
    setTimeout(() => connection.close(), 550);
  });
}

(async () => {
  for (const path of cases) {
    await probeWebSocket(path);
  }
})();
