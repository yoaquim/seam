/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createDevApiProxy } from "./server/dev-api-proxy";

// Proxy /api to the local API server, resolving its port from .seam/api-port
// on every request — the server may start after Vite (npm run dev starts them
// in parallel) or restart on a fallback port mid-session.
function seamApiProxy(): Plugin {
  const portFile = path.resolve(__dirname, ".seam", "api-port");
  return {
    name: "seam-api-proxy",
    configureServer(server) {
      server.middlewares.use(createDevApiProxy(portFile));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seamApiProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
