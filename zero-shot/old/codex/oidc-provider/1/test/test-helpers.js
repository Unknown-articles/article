import fs from 'node:fs/promises';

export async function removeFileIfExists(filename) {
  try {
    await fs.unlink(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export function closeDatabase(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
