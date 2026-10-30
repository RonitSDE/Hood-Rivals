import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { staticAssets } from "../server/static";

test("static assets: precompressed negotiation, immutable hashed caching, safe paths", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hr-static-"));
  const js = "console.log('hood rivals');".repeat(100);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets/app-abc123.js"), js);
  writeFileSync(join(dir, "assets/app-abc123.js.br"), brotliCompressSync(js));
  writeFileSync(join(dir, "assets/app-abc123.js.gz"), gzipSync(js));
  writeFileSync(join(dir, "logo.png"), Buffer.from([137, 80, 78, 71]));
  const app = express();
  app.use(staticAssets(dir));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    let r = await fetch(base + "/assets/app-abc123.js", { headers: { "Accept-Encoding": "br" } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-encoding"), "br");
    assert.match(r.headers.get("content-type") || "", /javascript/);
    assert.match(r.headers.get("cache-control") || "", /immutable/);
    assert.match(r.headers.get("vary") || "", /Accept-Encoding/);
    assert.equal(await r.text(), js);

    r = await fetch(base + "/assets/app-abc123.js", { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(r.headers.get("content-encoding"), "gzip");
    assert.equal(await r.text(), js);

    r = await fetch(base + "/assets/app-abc123.js", { headers: { "Accept-Encoding": "identity" } });
    assert.equal(r.headers.get("content-encoding"), null);
    assert.equal(await r.text(), js);

    r = await fetch(base + "/logo.png");
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.headers.get("cache-control") || "", /immutable/);

    r = await fetch(base + "/%2e%2e/%2e%2e/etc/passwd.js", { headers: { "Accept-Encoding": "br" } });
    assert.notEqual(r.status, 200);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
