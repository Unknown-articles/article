const fs = require("node:fs");
const path = require("node:path");
const { run } = require("./harness");

const files = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".test.js"))
  .sort();

for (const file of files) {
  require(path.join(__dirname, file));
}

run();
