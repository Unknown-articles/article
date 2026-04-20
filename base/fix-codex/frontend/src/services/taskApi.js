import { apiBaseUrl } from '../config.js';

function buildHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchTasks(accessToken) {
  const response = await fetch(`${apiBaseUrl}/tasks?_sort=order&_order=asc`, {
    headers: buildHeaders(accessToken),
  });
  return response.json();
}

export async function createTask(accessToken, payload) {
  const response = await fetch(`${apiBaseUrl}/tasks`, {
    method: 'POST',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function patchTask(accessToken, taskId, updates) {
  const response = await fetch(`${apiBaseUrl}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteTaskRequest(accessToken, taskId) {
  await fetch(`${apiBaseUrl}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: buildHeaders(accessToken),
  });
}

export async function replaceTasks(accessToken, tasks) {
  const response = await fetch(`${apiBaseUrl}/tasks`, {
    method: 'PUT',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(tasks),
  });
  return response.json();
}
