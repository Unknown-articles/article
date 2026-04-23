import WebSocket from 'ws';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const ws = new WebSocket('ws://localhost:4000/ws');
  
  ws.on('message', (data) => {
    console.log(`Received:`, data.toString());
  });

  ws.on('open', async () => {
    console.log('Connected to /ws');
    await delay(200);

    // 1. Invalid JSON
    console.log('--- 1. Invalid JSON ---');
    ws.send('{ invalid: json');
    await delay(200);
    
    // 2. Unknown action
    console.log('--- 2. Unknown action ---');
    ws.send(JSON.stringify({ action: 'magic', metrics: ['cpu'] }));
    await delay(200);
    
    // 3. Missing action
    console.log('--- 3. Missing action ---');
    ws.send(JSON.stringify({ metrics: ['cpu'] }));
    await delay(200);

    // 4. Unknown metric type
    console.log('--- 4. Unknown metric type ---');
    ws.send(JSON.stringify({ action: 'subscribe', metrics: ['cpu', 'fake'] }));
    await delay(200);

    // 5. Empty metrics array
    console.log('--- 5. Empty metrics array ---');
    ws.send(JSON.stringify({ action: 'subscribe', metrics: [] }));
    await delay(200);

    // 6. Missing metrics array
    console.log('--- 6. Missing metrics array ---');
    ws.send(JSON.stringify({ action: 'subscribe' }));
    await delay(200);

    ws.close();
  });
}

run();
