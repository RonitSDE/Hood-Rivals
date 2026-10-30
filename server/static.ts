import express, { type RequestHandler } from "express";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt)$/;

/**
 * Serves the Vite build with:
 *  - precompressed .br / .gz siblings (written at build time) when the browser accepts them
 *  - year-long immutable caching for content-hashed files under /assets
 *  - short revalidated caching for everything else (index.html is never cached stale)
 */
export function staticAssets(dir: string): RequestHandler {
  const root = resolve(dir);
  const serve = express.static(root, {
    index: false,
    setHeaders(res, path) {
      const rel = path.slice(root.length).replace(/\\/g, "/");
      if (rel.startsWith("/assets/")) res.set("Cache-Control", "public, max-age=31536000, immutable");
      else if (/\.html(\.(br|gz))?$/.test(rel)) res.set("Cache-Control", "no-cache");
      else res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    },
  });
  const exists = new Map<string, boolean>();
  const has = (file: string) => {
    let hit = exists.get(file);
    if (hit === undefined) {
      hit = existsSync(file) && statSync(file).isFile();
      if (exists.size < 5000) exists.set(file, hit);
    }
    return hit;
  };
  return (req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || !COMPRESSIBLE.test(req.path))
      return serve(req, res, next);
    const accepts = String(req.headers["accept-encoding"] || "");
    const encoding = /\bbr\b/.test(accepts) ? "br" : /\bgzip\b/.test(accepts) ? "gz" : "";
    res.vary("Accept-Encoding");
    if (!encoding) return serve(req, res, next);
    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return serve(req, res, next);
    }
    const file = join(root, pathname);
    if (!file.startsWith(root + sep) || !has(`${file}.${encoding}`)) return serve(req, res, next);
    res.type(extname(pathname));
    res.set("Content-Encoding", encoding === "br" ? "br" : "gzip");
    req.url = req.url.replace(req.path, `${req.path}.${encoding}`);
    return serve(req, res, next);
  };
}

/** Shown instead of a crash when the site has not been built yet. */
export const MISSING_BUILD_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hood Rivals: build needed</title>
<style>body{font:16px/1.6 system-ui,sans-serif;background:#0f2233;color:#eef4f2;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:560px;padding:24px}code{background:#163449;padding:2px 6px}</style></head>
<body><main><h1>The site has not been built yet</h1>
<p>The API is running, but there is no <code>dist/</code> folder to serve.</p>
<p>For development run <code>npm run dev</code> and open <code>http://localhost:5173</code>.</p>
<p>For a production-style run use <code>npm run build</code> then <code>npm start</code>.</p></main></body></html>`;

/** Newest modification time (ms) of any file under `dir`, or 0 when it does not exist. */
function newest(dir: string): number {
  if (!existsSync(dir)) return 0;
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
}

/** In a source checkout, explains when `dist/` is missing or older than the client code it was built from. */
export function buildStatus(dist = "dist"): string | null {
  const built = existsSync(join(dist, "index.html")) ? statSync(join(dist, "index.html")).mtimeMs : 0;
  if (!built)
    return "No build found in dist/. Run `npm run build` (or use `npm run dev`) before opening the site.";
  const source = Math.max(newest("client"), newest("public"), newest("shared"));
  if (source > built)
    return "dist/ is older than the client source, so the site will show an outdated version. Run `npm run build` (or use `npm run dev`).";
  return null;
}
