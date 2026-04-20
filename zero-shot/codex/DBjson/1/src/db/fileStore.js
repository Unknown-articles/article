const fs = require("fs/promises");
const path = require("path");

class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch (error) {
      await this.write({
        meta: { version: 1 },
        _auth: { users: [], teams: [] },
      });
    }
  }

  async read() {
    return this.runExclusive(() => this.readDirect());
  }

  async write(data) {
    return this.runExclusive(() => this.writeDirect(data));
  }

  async update(mutator) {
    return this.runExclusive(async () => {
      const data = await this.readDirect();
      const result = await mutator(data);
      await this.writeDirect(data);
      return result;
    });
  }

  async readDirect() {
    const content = await fs.readFile(this.filePath, "utf8");
    return normalizeDatabase(JSON.parse(content));
  }

  async writeDirect(data) {
    const tempFile = `${this.filePath}.tmp`;
    const json = JSON.stringify(data, null, 2);

    await fs.writeFile(tempFile, json, "utf8");
    await fs.rename(tempFile, this.filePath);

    return data;
  }

  async runExclusive(task) {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function normalizeDatabase(parsed) {
  if (!parsed.meta) {
    parsed.meta = { version: 1 };
  }

  if (!parsed._auth || typeof parsed._auth !== "object") {
    parsed._auth = { users: [], teams: [] };
  }

  if (!Array.isArray(parsed._auth.users)) {
    parsed._auth.users = [];
  }

  if (!Array.isArray(parsed._auth.teams)) {
    parsed._auth.teams = [];
  }

  return parsed;
}

module.exports = {
  FileStore,
};
