/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { existsSync, readFileSync } from "fs";

// Read the API server's actual port (written by server/index.ts on startup).
// Falls back to 3001 if the file is missing.
function readApiPort(): number {
  const portFile = path.resolve(__dirname, ".seam", "api-port");
  if (existsSync(portFile)) {
    const n = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 3001;
}

export default defineConfig(() => {
  const apiPort = readApiPort();
  const apiTarget = `http://localhost:${apiPort}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test-setup.ts",
    },
  };
});
