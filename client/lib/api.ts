/** JSON client for the game server. Every request carries the session's CSRF token. */
let csrf = "";

export function setCsrf(token: string) {
  csrf = token;
}

export async function api(path: string, body?: unknown, method = body ? "POST" : "GET") {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}
