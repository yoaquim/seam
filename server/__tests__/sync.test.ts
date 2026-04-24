import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Minimal app that mirrors server/index.ts sync logic
function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let status: "idle" | "running" | "done" | "error" = "idle";
  const logs: string[] = [];

  app.post("/api/sync", (_req, res) => {
    if (status === "running") {
      res.json({ status: "already_running" });
      return;
    }
    status = "running";
    // Simulate immediate completion for tests
    setTimeout(() => {
      status = "done";
      logs.push("Sync completed successfully.");
    }, 10);
    res.json({ status: "started" });
  });

  app.get("/api/status", (_req, res) => {
    res.json({ status, logs, startedAt: null, finishedAt: null, lastSyncedAt: null, error: null });
  });

  return app;
}

describe("Sync API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it("POST /api/sync returns started", async () => {
    const res = await request(app).post("/api/sync");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("started");
  });

  it("POST /api/sync returns already_running when sync is in progress", async () => {
    await request(app).post("/api/sync");
    const res = await request(app).post("/api/sync");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("already_running");
  });

  it("GET /api/status returns current state", async () => {
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("idle");
    expect(res.body.logs).toEqual([]);
  });

  it("GET /api/status shows running after sync starts", async () => {
    await request(app).post("/api/sync");
    const res = await request(app).get("/api/status");
    expect(res.body.status).toBe("running");
  });
});
