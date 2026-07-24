import http from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { existsSync, readFileSync } from "fs";

export const DEFAULT_API_PORT = 3001;

// Read the API server's actual port (written by server/index.ts on startup).
// Falls back to DEFAULT_API_PORT if the file is missing or unreadable.
export function readApiPort(portFile: string): number {
  if (existsSync(portFile)) {
    const n = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_API_PORT;
}

// Connect-style middleware that proxies /api requests to the API server,
// resolving its port from the port file on every request. The API server may
// start after Vite or restart on a fallback port mid-session, so the target
// cannot be fixed at config-load time.
export function createDevApiProxy(portFile: string) {
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    if (!req.url || !req.url.startsWith("/api")) {
      next();
      return;
    }

    const port = readApiPort(portFile);
    const proxyReq = http.request(
      {
        host: "127.0.0.1",
        port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({ error: `API server unreachable on port ${port}` }));
    });

    req.pipe(proxyReq);
  };
}
