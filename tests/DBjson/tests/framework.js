'use strict';

/**
 * Minimal test framework with colored output.
 * No external test framework — plain Node.js.
 */

const suites = [];
let passed = 0;
let failed = 0;
let skipped = 0;

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function suite(name, fn) {
  suites.push({ name, fn });
}

async function runSuites() {
  const context = {};  // shared state between suites

  for (const s of suites) {
    console.log(`\n${c.cyan}${c.bold}▶  ${s.name}${c.reset}`);
    try {
      await s.fn(context);
    } catch (err) {
      console.log(`  ${c.red}✗ Suite-level error: ${err.message}${c.reset}`);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `${c.bold}Results:${c.reset}  ` +
    `${c.green}${passed} passed${c.reset}  ` +
    `${c.red}${failed} failed${c.reset}  ` +
    `${c.yellow}${skipped} skipped${c.reset}`
  );
  console.log('─'.repeat(60));

  if (failed > 0) process.exit(1);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${c.green}✓${c.reset} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} ${name}`);
    console.log(`    ${c.gray}${err.message}${c.reset}`);
    failed++;
  }
}

function skip(name) {
  console.log(`  ${c.yellow}○${c.reset} ${name} ${c.gray}(skipped)${c.reset}`);
  skipped++;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertStatus(res, expected) {
  const codes = Array.isArray(expected) ? expected : [expected];
  if (!codes.includes(res.status)) {
    const label = codes.length === 1 ? String(codes[0]) : `[${codes.join(' or ')}]`;
    throw new Error(`Expected HTTP ${label}, got ${res.status}. Body: ${JSON.stringify(res.data)}`);
  }
}

module.exports = { suite, test, skip, assert, assertEqual, assertStatus, runSuites };
