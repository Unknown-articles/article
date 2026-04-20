'use strict';

/**
 * Resets the server's database to an empty state.
 *
 * Run this BEFORE starting the server, then restart the server so it picks
 * up the empty database from disk.
 *
 * Usage:
 *   npm run reset-db
 *   # then restart the API server
 *   npm test
 */

const fs   = require('fs');
const path = require('path');

// Path to the API server's database file
const DB_PATH = path.resolve(
  __dirname,
  '../../zero-shot/claude/DBjson/data.json'
);

// Try alternate path if the above doesn't exist
const ALT_PATH = path.resolve(
  __dirname,
  '../../../claude/DBjson/data.json'
);

function resolvePath() {
  if (fs.existsSync(DB_PATH)) return DB_PATH;
  if (fs.existsSync(ALT_PATH)) return ALT_PATH;

  // Walk up to find the file
  const candidates = [
    path.resolve(__dirname, '../../../../zero-shot/claude/DBjson/data.json'),
    path.resolve(__dirname, '../../../../../claude/DBjson/data.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const target = resolvePath();

if (!target) {
  // Try to find it by the known absolute path pattern
  const absoluteGuess = 'C:/Users/diegt/Documents/architecture-projects/zero-shot/claude/DBjson/data.json';
  if (fs.existsSync(absoluteGuess)) {
    writeEmpty(absoluteGuess);
  } else {
    console.error('❌  Could not locate data.json. Set DB_PATH env var or edit this script.');
    console.error('    Expected location: zero-shot/claude/DBjson/data.json');
    process.exit(1);
  }
} else {
  writeEmpty(target);
}

function writeEmpty(p) {
  const empty = { _users: [], _teams: [] };
  fs.writeFileSync(p, JSON.stringify(empty, null, 2), 'utf8');
  console.log(`✓  Database reset: ${p}`);
  console.log('   Please restart the API server before running tests.');
}
