const fs = require("node:fs/promises");
const path = require("node:path");
const { clone } = require("./utils");

const DEFAULT_DATA = {
  _meta: {
    version: 1,
  },
  _users: [],
  _teams: [],
};

class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await this.#writeFile(DEFAULT_DATA);
    }
  }

  async read() {
    return this.#enqueue(async () => clone(await this.#readFile()));
  }

  async transact(mutator) {
    return this.#enqueue(async () => {
      const data = await this.#readFile();
      const result = await mutator(data);
      await this.#writeFile(data);
      return clone(result);
    });
  }

  #enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async #readFile() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed._meta) {
      parsed._meta = { version: 1 };
    }
    if (!Array.isArray(parsed._users)) {
      parsed._users = [];
    }
    if (!Array.isArray(parsed._teams)) {
      parsed._teams = [];
    }

    return parsed;
  }

  async #writeFile(data) {
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, this.filePath);
  }
}

module.exports = {
  DataStore,
  DEFAULT_DATA,
};
