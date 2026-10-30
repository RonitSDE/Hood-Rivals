import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { precompress } from "./scripts/vite-precompress.ts";

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
      proxy: {
        "/api": "http://127.0.0.1:3000",
        "/healthz": "http://127.0.0.1:3000",
      },
    },
  };
});
