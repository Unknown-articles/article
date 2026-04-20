const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function buildHeaders(token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body != null) headers['Content-Type'] = 'application/json';
  return headers;
}

async function request(path, token, method = 'GET', body = null) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: buildHeaders(token, body),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`API request failed ${res.status}: ${payload}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function fetchTasks(token) {
  return request('/tasks?_sort=order&_order=asc', token);
}

export function createTask(task, token) {
  return request('/tasks', token, 'POST', task);
}

export function patchTask(id, updates, token) {
  return request(`/tasks/${id}`, token, 'PATCH', updates);
}

export function putTask(id, task, token) {
  return request(`/tasks/${id}`, token, 'PUT', task);
}

export function deleteTask(id, token) {
  return request(`/tasks/${id}`, token, 'DELETE');
}

export function batchUpdateTasks(collection, items, token) {
  return request(`/${collection}/batch`, token, 'PATCH', items);
}
