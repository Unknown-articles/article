const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

let isWorking = false;
const queue = [];

function processQueue() {
    if (isWorking || queue.length === 0) return;
    isWorking = true;
    const task = queue.shift();
    
    task()
        .catch(err => console.error("DB Task Error", err))
        .finally(() => {
            isWorking = false;
            processQueue();
        });
}

function runDbTask(fn) {
    return new Promise((resolve, reject) => {
        queue.push(async () => {
            try {
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
        processQueue();
    });
}

async function _readDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await _writeDB({});
            return {};
        }
        throw err;
    }
}

async function _writeDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function getDB() {
    return runDbTask(async () => {
        return await _readDB();
    });
}

async function updateDB(callback) {
    return runDbTask(async () => {
        const db = await _readDB();
        const result = await callback(db);
        if (result !== false) {
            await _writeDB(db);
        }
        return result; 
    });
}

module.exports = {
    getDB,
    updateDB
};
