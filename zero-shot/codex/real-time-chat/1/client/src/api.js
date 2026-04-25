const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function parseResponse(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export async function authenticate(mode, credentials) {
  const response = await fetch(`${API_URL}/auth/${mode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  return parseResponse(response);
}
