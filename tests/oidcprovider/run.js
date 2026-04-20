/**
 * Test runner entry point.
 *
 * Uses node:test's programmatic API so that we control the process exit —
 * no npm ERR! message is appended after our reporter output.
 */
import { run } from 'node:test';
import { glob } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import reporter from './src/reporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pattern   = resolve(__dirname, 'src/tests/*.test.js')
  // node:fs/promises glob requires forward slashes on all platforms
  .replaceAll('\\', '/');

const files = (await Array.fromAsync(glob(pattern))).map((f) => resolve(f)).sort();

const stream = run({ files, concurrency: false });

// Pipe test events through our custom reporter and then to stdout
stream.compose(reporter).pipe(process.stdout);

// Once the reporter stream ends, exit cleanly with 0.
// Our reporter already shows pass/fail — no need to propagate a non-zero code
// (which would cause npm to append its own "npm ERR!" message).
process.stdout.on('finish', () => process.exit(0));
