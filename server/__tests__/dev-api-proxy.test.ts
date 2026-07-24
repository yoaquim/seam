import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "http";
import path from "path";
import os from "os";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { readApiPort, createDevApiProxy, DEFAULT_API_PORT } from "../dev-api-proxy";

let tmpDir: string;
let portFile: string;
let servers: http.Server[];

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 0);
    });
  });
}

async function startBackend(body: string): Promise<number> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ from: body, url: req.url }));
  });
  servers.push(server);
  return listen(server);
}

async function startProxy(): Promise<number> {
  const middleware = createDevApiProxy(portFile);
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.writeHead(418);
      res.end("passed-through");
    });
  });
  servers.push(server);
  return listen(server);
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "seam-proxy-test-"));
  portFile = path.join(tmpDir, "api-port");
  servers = [];
});

afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("readApiPort", () => {
  it("reads the port from the file", () => {
    writeFileSync(portFile, "4123\n");
    expect(readApiPort(portFile)).toBe(4123);
  });

  it("falls back to the default when the file is missing", () => {
    expect(readApiPort(portFile)).toBe(DEFAULT_API_PORT);
  });

  it("falls back to the default when the file is garbage", () => {
    writeFileSync(portFile, "not-a-port");
    expect(readApiPort(portFile)).toBe(DEFAULT_API_PORT);
  });
});

describe("createDevApiProxy", () => {
  it("proxies /api requests to the port in the file", async () => {
    const backendPort = await startBackend("backend-a");
    writeFileSync(portFile, String(backendPort));
    const proxyPort = await startProxy();

    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/settings`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { from: string; url: string };
    expect(data.from).toBe("backend-a");
    expect(data.url).toBe("/api/settings");
  });

  it("re-reads the port file on every request", async () => {
    const portA = await startBackend("backend-a");
    const portB = await startBackend("backend-b");
    writeFileSync(portFile, String(portA));
    const proxyPort = await startProxy();

    const first = await fetch(`http://127.0.0.1:${proxyPort}/api/x`);
    expect(((await first.json()) as { from: string }).from).toBe("backend-a");

    // Simulate the API server restarting on a different port mid-session
    writeFileSync(portFile, String(portB));
    const second = await fetch(`http://127.0.0.1:${proxyPort}/api/x`);
    expect(((await second.json()) as { from: string }).from).toBe("backend-b");
  });

  it("passes non-/api requests through to the next handler", async () => {
    const proxyPort = await startProxy();

    const res = await fetch(`http://127.0.0.1:${proxyPort}/manifest.json`);
    expect(res.status).toBe(418);
    expect(await res.text()).toBe("passed-through");
  });

  it("returns 502 when the API server is unreachable", async () => {
    const deadPort = await startBackend("dead");
    await new Promise((r) => servers.pop()!.close(r));
    writeFileSync(portFile, String(deadPort));
    const proxyPort = await startProxy();

    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/settings`);
    expect(res.status).toBe(502);
  });
});
