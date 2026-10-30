import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { precompress } from "./scripts/vite-precompress.ts";

// The API only accepts requests from APP_ORIGIN (default http://localhost:3000). In dev the page runs on
// :5173, so the proxy presents forwarded requests as coming from the API's own origin.
const apiOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
const devProxy = () => ({
  target: "http://127.0.0.1:" + (process.env.PORT || 3000),
  configure: (proxy: any) =>
    proxy.on("proxyReq", (req: any) => {
      if (req.getHeader("origin")) req.setHeader("origin", apiOrigin);
    }),
});

export default defineConfig(({ command }) => {
  // `.env` sets NODE_ENV=development for the local API server. Without this guard Vite
  // picks that up and ships React's development build (~4x larger and much slower).
  if (command === "build") process.env.VITE_USER_NODE_ENV = "production";
  return {
    plugins: [react(), precompress()],
    build: {
      outDir: "dist",
      sourcemap: false,
      target: "es2022",
      cssCodeSplit: true,
      reportCompressedSize: false,
      // Remaining large chunks are third-party wallet SDKs, loaded only when a captain logs in.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          // Keep React in its own long-cached chunk so app releases don't re-download it.
          codeSplitting: {
            groups: [{ name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 }],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: { "/api": devProxy(), "/healthz": devProxy() },
    },
  };
});
