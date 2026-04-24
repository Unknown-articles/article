import WebSocket from 'ws';

const cases = [
  '/ws/all',
  '/ws/cpu',
  '/ws',
  '/ws/invalid',
];

async function verifySocketPath(path) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:3000${path}`);
    const samples = [];
    socket.on('message', (msg) => samples.push(msg.toString()));
    socket.on('open', () => {});
    socket.on('close', () => {
      console.log(path, samples.length, JSON.stringify(samples));
      resolve();
    });
    socket.on('error', reject);
    setTimeout(() => socket.close(), 450);
  });
}

(async () => {
  for (const path of cases) {
    await verifySocketPath(path);
  }
})();
