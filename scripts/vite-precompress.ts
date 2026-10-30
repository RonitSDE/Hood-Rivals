import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import type { Plugin } from "vite";

const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|map)$/;

/** Writes .br and .gz siblings for text assets so the server can send them without runtime compression. */
export function precompress(minBytes = 1024): Plugin {
  let outDir = "dist";
  return {
    name: "hood-rivals:precompress",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
          const path = join(dir, name);
          return statSync(path).isDirectory() ? walk(path) : [path];
        });
      for (const file of walk(outDir)) {
        if (!COMPRESSIBLE.test(file)) continue;
        const source = readFileSync(file);
        if (source.length < minBytes) continue;
        writeFileSync(`${file}.br`, brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
        writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }));
      }
    },
  };
}
