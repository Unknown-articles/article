/**
 * Custom test reporter for the OIDC Provider test suite.
 * Receives test events from `node --test` and prints a formatted report.
 */
import { Transform } from 'node:stream';

const PASS  = '\x1b[32m✔\x1b[0m';
const FAIL  = '\x1b[31m✖\x1b[0m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';
const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const CYAN  = '\x1b[36m';
const YELLOW = '\x1b[33m';

const suiteStack = [];
const failures   = [];
let passed = 0;
let failed = 0;
let startTime = Date.now();

function indent(n) {
  return '  '.repeat(n);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default new Transform({
  readableObjectMode: false,
  writableObjectMode: true,

  transform(event, _encoding, callback) {
    const { type, data } = event;

    switch (type) {
      case 'test:start': {
        // Track suite nesting
        if (data.name && suiteStack.length === 0) {
          // top-level suite or test — do nothing yet
        }
        break;
      }

      case 'test:pass': {
        // nesting: data.nesting (0 = suite, 1 = test inside suite, etc.)
        if (data.nesting === 0) {
          // Suite-level pass — print suite header + footer
          process.stdout.write(
            `\n${CYAN}${BOLD}▶ ${data.name}${RESET}\n`
          );
          process.stdout.write(
            `${indent(1)}${GREEN}${BOLD}All tests passed${RESET} ${DIM}(${formatDuration(data.details?.duration_ms ?? 0)})${RESET}\n`
          );
        } else {
          passed++;
          process.stdout.write(
            `${indent(data.nesting)}${PASS} ${data.name} ${DIM}(${formatDuration(data.details?.duration_ms ?? 0)})${RESET}\n`
          );
        }
        break;
      }

      case 'test:fail': {
        if (data.nesting === 0) {
          // Suite-level failure — collect suite name for the report
          process.stdout.write(
            `\n${CYAN}${BOLD}▶ ${data.name}${RESET}\n`
          );
        } else {
          failed++;
          process.stdout.write(
            `${indent(data.nesting)}${FAIL} ${RED}${data.name}${RESET} ${DIM}(${formatDuration(data.details?.duration_ms ?? 0)})${RESET}\n`
          );

          // Collect the error for the Failures block at the end
          const err = data.details?.error;
          if (err) {
            const msg = err.cause?.message ?? err.message ?? String(err);
            failures.push({ name: data.name, message: msg });
          }
        }
        break;
      }

      // Ignore other event types
      default:
        break;
    }

    callback();
  },

  flush(callback) {
    const total    = passed + failed;
    const duration = formatDuration(Date.now() - startTime);
    const allPass  = failed === 0;
    const hr       = '─'.repeat(60);

    let out = '';

    if (failures.length > 0) {
      out += `\n${RED}${BOLD}Failures:${RESET}\n\n`;
      failures.forEach((f, i) => {
        out += `  ${RED}${i + 1}) ${f.name}${RESET}\n`;
        out += `     ${DIM}${f.message}${RESET}\n\n`;
      });
    }

    out += `\n${hr}\n`;
    out += `${BOLD}  Test Report${RESET}\n`;
    out += `${hr}\n`;
    out += `  ${DIM}Total   ${RESET} ${BOLD}${total}${RESET}\n`;
    out += `  ${DIM}Passed  ${RESET} ${GREEN}${BOLD}${passed}${RESET}\n`;
    out += `  ${DIM}Failed  ${RESET} ${failed > 0 ? RED : DIM}${BOLD}${failed}${RESET}\n`;
    out += `  ${DIM}Duration${RESET} ${duration}\n`;
    out += `${hr}\n`;

    if (allPass) {
      out += `\n  ${GREEN}${BOLD}All ${total} tests passed.${RESET}\n\n`;
    } else {
      out += `\n  ${RED}${BOLD}${failed} test(s) failed.${RESET}\n\n`;
    }

    // Single write — callback só é chamado após o flush completo no terminal
    process.stdout.write(out, callback);
  },
});
