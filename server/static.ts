import express, { type RequestHandler } from "express";
import { existsSync, statSync } from "node:fs";
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
    if ((req.method !== "GET" && req.method !== "HEAD") || !COMPRESSIBLE.test(req.path)) return serve(req, res, next);
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
