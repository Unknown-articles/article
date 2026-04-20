'use strict';

/**
 * Test harness: spins up a fresh server instance on TEST_PORT,
 * runs the test suite, then kills the server.
 *
 * Usage:
 *   node run.js              # uses default ports / paths below
 *   TEST_PORT=3001 node run.js
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const http       = require('http');
const os         = require('os');

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

const TEST_PORT  = parseInt(process.env.TEST_PORT || '3000', 10);
const SERVER_DIR = path.resolve(__dirname, 'C:/Users/diegt/Documents/architecture-projects/mult-turn/claude/DBjson/1');
const SERVER_ENTRY = path.join(SERVER_DIR, '', 'server.js');

// Temp DB file for this test run — isolated from the real data.json
const TEST_DB    = path.join(os.tmpdir(), `dbjson-test-${Date.now()}.json`);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function writeEmptyDb(p) {
  fs.writeFileSync(p, JSON.stringify({ _users: [], _teams: [] }, null, 2), 'utf8');
}

function startServer() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PORT:    String(TEST_PORT),
      DB_PATH: TEST_DB,
    };

    const proc = spawn('node', [SERVER_ENTRY], {
      env,
      cwd: SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', d => {
      const line = d.toString().trim();
      if (line) process.stdout.write(`  [server] ${line}\n`);
      if (line.includes('running on')) resolve(proc);
    });

    proc.stderr.on('data', d => {
      process.stderr.write(`  [server:err] ${d}`);
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout safety
    setTimeout(() => reject(new Error('Server did not start within 10s')), 10_000);
  });
}

function waitForHealth(retries = 20, delay = 300) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      http.get(`http://localhost:${TEST_PORT}/health`, res => {
        if (res.statusCode === 200) return resolve();
        retry(n);
      }).on('error', () => retry(n));

      function retry(n) {
        if (n <= 0) return reject(new Error('Health check timed out'));
        setTimeout(() => attempt(n - 1), delay);
      }
    }
    attempt(retries);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Run tests as a child process so they inherit stdout/stderr cleanly
// ──────────────────────────────────────────────────────────────────────────────

function runTests() {
  return new Promise((resolve) => {
    const proc = spawn('node', ['tests/runner.js'], {
      cwd: __dirname,
      env: { ...process.env, API_BASE: `http://localhost:${TEST_PORT}` },
      stdio: 'inherit',
    });
    proc.on('exit', code => resolve(code || 0));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

(async () => {
  const c = {
    bold: '\x1b[1m', reset: '\x1b[0m',
    cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m',
  };

  console.log(`\n${c.cyan}${c.bold}DBjson API – Integration Test Suite${c.reset}`);
  console.log('─'.repeat(60));
  console.log(`Test server port : ${TEST_PORT}`);
  console.log(`Test database    : ${TEST_DB}`);
  console.log(`Server source    : ${SERVER_ENTRY}`);
  console.log('─'.repeat(60));

  // 1. Write an empty DB
  writeEmptyDb(TEST_DB);
  console.log('\n✓ Empty test database created');

  // 2. Start the server
  console.log('  Starting server...');
  let serverProc;
  try {
    serverProc = await startServer();
    await waitForHealth();
    console.log(`✓ Server is healthy on port ${TEST_PORT}\n`);
  } catch (err) {
    console.error(`\n${c.red}✗ Server startup failed: ${err.message}${c.reset}`);
    process.exit(1);
  }

  // 3. Run tests
  let exitCode = 0;
  try {
    exitCode = await runTests();
  } finally {
    // 4. Tear down
    serverProc.kill('SIGTERM');
    fs.unlinkSync(TEST_DB);
    console.log('\n✓ Test server stopped, temp DB cleaned up');
  }

  process.exit(exitCode);
})();
