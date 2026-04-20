const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  let passed = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      passed += 1;
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      console.error(`not ok - ${entry.name}`);
      console.error(error.stack || error);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);
}

module.exports = {
  run,
  test,
};
