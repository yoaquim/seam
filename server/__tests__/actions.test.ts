import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import path from "path";
import os from "os";

function createApp(dataDir: string) {
  const app = express();
  app.use(express.json());

  app.put("/api/recordings/:dirName/actions/:index", (req, res) => {
    const { dirName, index } = req.params;
    const { completed } = req.body as { completed: boolean };

    const analysisFile = path.join(dataDir, "analysis", dirName, "analysis.json");
    if (!existsSync(analysisFile)) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    const data = JSON.parse(require("fs").readFileSync(analysisFile, "utf-8"));
    const i = parseInt(index, 10);
    if (data.action_items?.[i]) {
      data.action_items[i].completed = completed;
      writeFileSync(analysisFile, JSON.stringify(data, null, 2));
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "Action item not found" });
    }
  });

  return app;
}

describe("Actions API", () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `seam-test-actions-${Date.now()}`);
    const analysisDir = path.join(tmpDir, "analysis", "2026-04-22_test");
    mkdirSync(analysisDir, { recursive: true });
    writeFileSync(
      path.join(analysisDir, "analysis.json"),
      JSON.stringify({
        action_items: [
          { task: "Fix bug", owner: "Alice", completed: false },
          { task: "Write docs", owner: "Bob", completed: false },
        ],
      }),
    );
    app = createApp(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("toggles action item to completed", async () => {
    const res = await request(app)
      .put("/api/recordings/2026-04-22_test/actions/0")
      .send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify persisted
    const data = JSON.parse(
      require("fs").readFileSync(
        path.join(tmpDir, "analysis", "2026-04-22_test", "analysis.json"),
        "utf-8",
      ),
    );
    expect(data.action_items[0].completed).toBe(true);
    expect(data.action_items[1].completed).toBe(false);
  });

  it("toggles action item back to incomplete", async () => {
    // First complete it
    await request(app).put("/api/recordings/2026-04-22_test/actions/0").send({ completed: true });
    // Then uncomplete
    const res = await request(app)
      .put("/api/recordings/2026-04-22_test/actions/0")
      .send({ completed: false });
    expect(res.status).toBe(200);

    const data = JSON.parse(
      require("fs").readFileSync(
        path.join(tmpDir, "analysis", "2026-04-22_test", "analysis.json"),
        "utf-8",
      ),
    );
    expect(data.action_items[0].completed).toBe(false);
  });

  it("returns 404 for unknown recording", async () => {
    const res = await request(app)
      .put("/api/recordings/nonexistent/actions/0")
      .send({ completed: true });
    expect(res.status).toBe(404);
  });

  it("returns 404 for out-of-range index", async () => {
    const res = await request(app)
      .put("/api/recordings/2026-04-22_test/actions/99")
      .send({ completed: true });
    expect(res.status).toBe(404);
  });
});
