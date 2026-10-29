import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app";
import { config } from "../server/config";

test("production origin, session cookie, CSRF, profile input and logout boundaries", async () => {
  const runtime = createApp({ ...config, db: ":memory:", production: true, origin: "https://outpost.example" });
  const server = runtime.app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path: string, body?: any, headers: Record<string,string> = {}) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await request("/api/session", {})).status, 403);
    assert.equal((await request("/api/session", {}, { origin: "https://attacker.example" })).status, 403);
    const signed = await request("/api/session", {}, { origin: "https://outpost.example" });
    assert.equal(signed.status, 200);
    const cookieHeader = signed.headers.get("set-cookie") || "";
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /Secure/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    const cookie = cookieHeader.split(";")[0];
    const { csrf } = await signed.json();
    const bootstrap = await request("/api/bootstrap", undefined, {cookie});
    assert.equal(bootstrap.headers.get("cache-control"),"no-store");
    assert.equal(bootstrap.headers.get("strict-transport-security"),"max-age=31536000");
    const profile = { name: "<img src=x onerror=alert(1)>", faction: 0, stance: "balanced" };
    assert.equal((await fetch(base + "/api/profile", { method: "PATCH", headers: {
      "content-type": "application/json", origin: "https://outpost.example", cookie,
      "x-csrf-token": csrf,
    }, body: JSON.stringify(profile) })).status, 422);
    assert.equal((await request("/api/session/logout", {}, { origin: "https://outpost.example", cookie })).status, 403);
    assert.equal((await request("/api/session/logout", {}, { origin: "https://outpost.example", cookie, "x-csrf-token": csrf })).status, 200);
    assert.equal((await request("/api/bootstrap", undefined, { cookie })).status, 401);
    const app = await request("/");
    assert.match(app.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
    assert.equal(app.headers.get("x-content-type-options"), "nosniff");
    const world = await request("/observatory.html");
    assert.match(world.headers.get("content-security-policy") || "", /frame-ancestors 'self'/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    runtime.close();
  }
});
