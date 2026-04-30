const fs = require("fs/promises");
const path = require("path");

const DEFAULT_DB = { _users: [], _teams: [] };

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), "db.json");
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const db = await this.read();
      await this.writeRaw(this.normalize(db));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.writeRaw(DEFAULT_DB);
    }
  }

  normalize(db) {
    const next = db && typeof db === "object" && !Array.isArray(db) ? db : {};
    if (!Array.isArray(next._users)) next._users = [];
    if (!Array.isArray(next._teams)) next._teams = [];
    return next;
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return this.normalize(parsed);
  }

  async writeRaw(db) {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(this.normalize(db), null, 2)}\n`);
    await fs.rename(tmp, this.filePath);
  }

  async transaction(fn) {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.writeRaw(db);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async view(fn) {
    const run = this.queue.then(async () => fn(await this.read()));
    this.queue = run.catch(() => {});
    return run;
  }
}

module.exports = { JsonStore };
