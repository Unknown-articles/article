const fs = require("fs/promises");
const path = require("path");

const DEFAULT_DB = { _users: [], _teams: [] };

class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), "db.json");
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await this.read();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.write(DEFAULT_DB);
    }
  }

  async read() {
    const content = await fs.readFile(this.filePath, "utf8");
    const data = content.trim() ? JSON.parse(content) : {};
    return {
      ...DEFAULT_DB,
      ...data,
      _users: Array.isArray(data._users) ? data._users : [],
      _teams: Array.isArray(data._teams) ? data._teams : [],
    };
  }

  async write(data) {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    await fs.rename(tempPath, this.filePath);
  }

  async transaction(mutator) {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this.write(data);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async snapshot() {
    return this.queue.then(() => this.read());
  }
}

module.exports = { JsonDatabase };
