'use strict';

/**
 * Test entry point.
 * Loads each suite module and then executes all suites in sequence.
 */

require('./01-health');
require('./02-auth');
require('./03-crud');
require('./04-rbac');
require('./05-ownership');
require('./06-sharing');
require('./07-querying');
require('./08-concurrency');

const { runSuites } = require('./framework');

runSuites().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
