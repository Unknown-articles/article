const fs = require('fs').promises;
const path = require('path');

const RESERVED_COLLECTIONS = ['auth'];

class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
    this.initialData = {
      _users: [],
      _teams: []
    };
    this.ready = this.initFile();
  }

  async initFile() {
    try {
      await fs.access(this.filePath);
      const text = await fs.readFile(this.filePath, 'utf8');
      if (!text.trim()) {
        await fs.writeFile(this.filePath, JSON.stringify(this.initialData, null, 2), 'utf8');
      }
    } catch (error) {
      await fs.mkdir(path.dirname(this.filePath), {recursive: true});
      await fs.writeFile(this.filePath, JSON.stringify(this.initialData, null, 2), 'utf8');
    }
  }

  withLock(fn) {
    const result = this.queue.then(() => fn(), () => fn());
    this.queue = result.catch(() => {});
    return result;
  }

  async rawRead() {
    try {
      const body = await fs.readFile(this.filePath, 'utf8');
      try {
        return JSON.parse(body || '{}');
      } catch (error) {
        await fs.writeFile(this.filePath, JSON.stringify(this.initialData, null, 2), 'utf8');
        return {...this.initialData};
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.initFile();
        const body = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(body || '{}');
      }
      throw error;
    }
  }

  async rawWrite(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async read() {
    await this.ready;
    return this.withLock(() => this.rawRead());
  }

  async write(data) {
    await this.ready;
    return this.withLock(() => this.rawWrite(data));
  }

  async getCollection(name) {
    const db = await this.read();
    return db[name] || [];
  }

  async ensureCollection(name) {
    await this.ready;
    return this.withLock(async () => {
      const db = await this.rawRead();
      if (!db[name]) {
        db[name] = [];
        await this.rawWrite(db);
      }
      return db[name];
    });
  }

  async addItem(collection, item) {
    await this.ready;
    return this.withLock(async () => {
      const db = await this.rawRead();
      if (!db[collection]) db[collection] = [];
      db[collection].push(item);
      await this.rawWrite(db);
      return item;
    });
  }

  async updateItem(collection, id, item) {
    await this.ready;
    return this.withLock(async () => {
      const db = await this.rawRead();
      const items = db[collection] || [];
      const index = items.findIndex((entry) => entry.id === id);
      if (index === -1) return null;
      items[index] = item;
      await this.rawWrite(db);
      return item;
    });
  }

  async removeItem(collection, id) {
    await this.ready;
    return this.withLock(async () => {
      const db = await this.rawRead();
      const items = db[collection] || [];
      const index = items.findIndex((entry) => entry.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      await this.rawWrite(db);
      return true;
    });
  }

  async getItem(collection, id) {
    const items = await this.getCollection(collection);
    return items.find((entry) => entry.id === id) || null;
  }

  static isReservedCollection(name) {
    return !name || name === 'auth' || name.startsWith('_') || RESERVED_COLLECTIONS.includes(name);
  }
}

module.exports = DataStore;
