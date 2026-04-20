/**
 * Test runner — executes all test suites and prints a report.
 * Exits with code 1 if any test fails.
 */
import { suite as restSuite } from './tests/rest.js';
import { suite as wsSuite } from './tests/websocket.js';
import { suite as broadcastSuite } from './tests/broadcast.js';

const SUITES = [restSuite, wsSuite, broadcastSuite];

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function pad(str, len) {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

async function runSuite(suite) {
  console.log(`\n${BOLD}${suite.name}${RESET}`);
  console.log('─'.repeat(60));

  const results = [];

  for (const test of suite.tests) {
    const label = pad(test.name, 56);
    try {
      await test.run();
      console.log(`  ${GREEN}✓${RESET} ${DIM}${label}${RESET}`);
      results.push({ name: test.name, passed: true });
    } catch (err) {
      console.log(`  ${RED}✗${RESET} ${label}`);
      console.log(`      ${RED}${err.message}${RESET}`);
      results.push({ name: test.name, passed: false, error: err.message });
    }
  }

  return results;
}

async function main() {
  console.log(`\n${BOLD}Resource Monitor — Test Suite${RESET}`);
  console.log(`Target: http://localhost:3000 / ws://localhost:3000`);
  console.log('='.repeat(60));

  // Verify server is reachable before running tests
  try {
    const res = await fetch('http://localhost:3000/health');
    if (!res.ok) throw new Error(`/health returned ${res.status}`);
  } catch (err) {
    console.error(`\n${RED}${BOLD}ERROR: Cannot reach server at http://localhost:3000${RESET}`);
    console.error(`  ${err.message}`);
    console.error('  Make sure the Resource Monitor is running before executing tests.\n');
    process.exit(1);
  }

  const allResults = [];

  for (const suite of SUITES) {
    const results = await runSuite(suite);
    allResults.push(...results);
  }

  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;
  const total = allResults.length;

  console.log('\n' + '='.repeat(60));
  console.log(`${BOLD}Results: ${passed}/${total} passed${RESET}`);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}Failed tests:${RESET}`);
    for (const r of allResults.filter((r) => !r.passed)) {
      console.log(`  ${RED}✗${RESET} ${r.name}`);
      console.log(`      ${DIM}${r.error}${RESET}`);
    }
    console.log('');
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}All tests passed!${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
