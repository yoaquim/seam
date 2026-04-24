import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import path from "path";
import os from "os";

function createApp(dataDir: string) {
  const app = express();
  app.use(express.json());

  app.put("/api/recordings/:dirName/speakers", (req, res) => {
    const { dirName } = req.params;
    const { assignments } = req.body as { assignments: Record<number, string> };

    const recFile = path.join(dataDir, "recordings", dirName, "recording.json");
    if (!existsSync(recFile)) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    const data = JSON.parse(require("fs").readFileSync(recFile, "utf-8"));
    for (const [idx, speaker] of Object.entries(assignments)) {
      const i = parseInt(idx, 10);
      if (data.transcript?.[i]) {
        data.transcript[i].speaker = speaker;
      }
    }
    writeFileSync(recFile, JSON.stringify(data, null, 2));
    res.json({ ok: true });
  });

  return app;
}

describe("Speakers API", () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `seam-test-speakers-${Date.now()}`);
    const recDir = path.join(tmpDir, "recordings", "2026-04-22_test");
    mkdirSync(recDir, { recursive: true });
    writeFileSync(
      path.join(recDir, "recording.json"),
      JSON.stringify({
        transcript: [
          { speaker: "Unknown", text: "Hello", start: 0, end: 2 },
          { speaker: "Unknown", text: "Hi there", start: 3, end: 5 },
          { speaker: "Unknown", text: "How are you?", start: 6, end: 8 },
        ],
      })
    );
    app = createApp(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("assigns speakers to transcript segments", async () => {
    const res = await request(app)
      .put("/api/recordings/2026-04-22_test/speakers")
      .send({ assignments: { 0: "Alice", 1: "Bob" } });
    expect(res.status).toBe(200);

    const data = JSON.parse(
      require("fs").readFileSync(
        path.join(tmpDir, "recordings", "2026-04-22_test", "recording.json"),
        "utf-8"
      )
    );
    expect(data.transcript[0].speaker).toBe("Alice");
    expect(data.transcript[1].speaker).toBe("Bob");
    expect(data.transcript[2].speaker).toBe("Unknown"); // unchanged
  });

  it("returns 404 for unknown recording", async () => {
    const res = await request(app)
      .put("/api/recordings/nonexistent/speakers")
      .send({ assignments: { 0: "Alice" } });
    expect(res.status).toBe(404);
  });

  it("ignores out-of-range indices", async () => {
    const res = await request(app)
      .put("/api/recordings/2026-04-22_test/speakers")
      .send({ assignments: { 99: "Ghost" } });
    expect(res.status).toBe(200);

    const data = JSON.parse(
      require("fs").readFileSync(
        path.join(tmpDir, "recordings", "2026-04-22_test", "recording.json"),
        "utf-8"
      )
    );
    // All still Unknown
    expect(data.transcript.every((s: any) => s.speaker === "Unknown")).toBe(true);
  });
});
