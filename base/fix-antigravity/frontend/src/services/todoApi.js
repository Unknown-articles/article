const BACKEND = 'http://localhost:3001';

export function createTodoApi(accessToken) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
  
  return {
    async fetchTasks() {
      const r = await fetch(`${BACKEND}/tasks?_sort=order&_order=asc`, { headers });
      return r.json();
    },
    async addTask(title, date, order, ownerId) {
      const r = await fetch(`${BACKEND}/tasks`, {
        method: 'POST', headers,
        body: JSON.stringify({ title, date: date || null, completed: false, ownerId, order })
      });
      return r.json();
    },
    async updateTask(id, updates) {
      const r = await fetch(`${BACKEND}/tasks/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
      return r.json();
    },
    async deleteTask(id) {
      await fetch(`${BACKEND}/tasks/${id}`, { method: 'DELETE', headers });
    },
    async replaceTask(id, task) {
      await fetch(`${BACKEND}/tasks/${id}`, { method: 'PUT', headers, body: JSON.stringify(task) });
    },
    async bulkPatchTasks(updatesArray) {
      const r = await fetch(`${BACKEND}/tasks/bulk`, { method: 'PATCH', headers, body: JSON.stringify(updatesArray) });
      return r.json();
    }
  };
}
