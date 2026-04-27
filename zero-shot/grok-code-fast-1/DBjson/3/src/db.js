const fs = require('fs-extra');
const path = require('path');

class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.queue = [];
    this.processing = false;
  }

  async init() {
    try {
      this.data = await fs.readJson(this.filePath);
    } catch (err) {
      this.data = { "_users": [], "_teams": [] };
      await fs.writeJson(this.filePath, this.data);
    }
  }

  async read() {
    return this.data;
  }

  async write(data) {
    this.data = data;
    await fs.writeJson(this.filePath, this.data);
  }

  async enqueueWrite(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { operation, resolve, reject } = this.queue.shift();
    try {
      const result = await operation();
      resolve(result);
    } catch (err) {
      reject(err);
    }
    this.processing = false;
    // Process next if any
    if (this.queue.length > 0) setImmediate(() => this.processQueue());
  }
}

module.exports = Database;