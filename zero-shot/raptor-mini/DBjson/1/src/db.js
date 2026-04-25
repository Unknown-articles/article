const fs = require('fs').promises;
const path = require('path');

class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      if (!raw.trim()) {
        await this.writeDB(this.createBase());
        return;
      }
      const parsed = JSON.parse(raw);
      const normalized = Object.assign({}, parsed);
      if (!Array.isArray(normalized._users)) normalized._users = [];
      if (!Array.isArray(normalized._teams)) normalized._teams = [];
      await this.writeDB(normalized);
    } catch (err) {
      if (err.code === 'ENOENT' || err.name === 'SyntaxError') {
        await this.writeDB(this.createBase());
        return;
      }
      throw err;
    }
  }

  createBase() {
    return { _users: [], _teams: [] };
  }

  queueOperation(operation) {
    this.queue = this.queue.then(() => operation()).catch((err) => {
      throw err;
    });
    return this.queue;
  }

  async readDB() {
    const raw = await fs.readFile(this.filePath, 'utf8');
    if (!raw.trim()) {
      return this.createBase();
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return this.createBase();
    }
    if (!Array.isArray(data._users)) data._users = [];
    if (!Array.isArray(data._teams)) data._teams = [];
    return data;
  }

  async writeDB(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async withData(fn) {
    return this.queueOperation(async () => {
      const data = await this.readDB();
      const result = await fn(data);
      await this.writeDB(data);
      return result;
    });
  }

  async getData() {
    return this.queueOperation(async () => this.readDB());
  }

  async getCollection(name) {
    return this.queueOperation(async () => {
      const data = await this.readDB();
      if (!Object.prototype.hasOwnProperty.call(data, name)) return null;
      return data[name];
    });
  }

  async ensureCollection(name) {
    return this.withData(async (data) => {
      if (!Object.prototype.hasOwnProperty.call(data, name)) {
        data[name] = [];
      }
      return data[name];
    });
  }

  async saveCollection(name, items) {
    return this.withData(async (data) => {
      data[name] = items;
      return data[name];
    });
  }
}

module.exports = JsonDB;
