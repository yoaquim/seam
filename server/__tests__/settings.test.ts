import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import os from "os";

function createApp(envFile: string) {
  const app = express();
  app.use(express.json());

  function readEnvFile(): Record<string, string> {
    const result: Record<string, string> = {};
    if (!existsSync(envFile)) return result;
    try {
      for (const line of readFileSync(envFile, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        result[key] = value;
      }
    } catch {}
    return result;
  }

  function maskKey(key: string): string {
    if (key.length <= 7) return "***";
    return key.slice(0, 3) + "***" + key.slice(-4);
  }

  function writeEnvUpdate(updates: Record<string, string>) {
    let lines: string[] = [];
    if (existsSync(envFile)) {
      lines = readFileSync(envFile, "utf-8").split("\n");
    }
    const updated = new Set<string>();
    lines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) return line;
      const key = trimmed.slice(0, eqIdx).trim();
      if (key in updates) {
        updated.add(key);
        return `${key}=${updates[key]}`;
      }
      return line;
    });
    for (const [key, value] of Object.entries(updates)) {
      if (!updated.has(key)) {
        lines.push(`${key}=${value}`);
      }
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    writeFileSync(envFile, lines.join("\n") + "\n");
  }

  app.get("/api/settings", (_req, res) => {
    const env = readEnvFile();
    res.json({
      configured: !!env["POCKET_API_KEY"],
      pocketApiKey: env["POCKET_API_KEY"] ? maskKey(env["POCKET_API_KEY"]) : "",
      s3Bucket: env["S3_BUCKET"] || "",
      s3Prefix: env["S3_PREFIX"] || "seam/",
      awsProfile: env["AWS_PROFILE"] || "",
      analysisModel: env["SEAM_ANALYSIS_MODEL"] || "",
    });
  });

  app.put("/api/settings", (req, res) => {
    const { pocketApiKey, s3Bucket, s3Prefix, awsProfile, analysisModel } = req.body;
    const updates: Record<string, string> = {};
    if (pocketApiKey !== undefined) updates["POCKET_API_KEY"] = pocketApiKey;
    if (s3Bucket !== undefined) updates["S3_BUCKET"] = s3Bucket;
    if (s3Prefix !== undefined) updates["S3_PREFIX"] = s3Prefix;
    if (awsProfile !== undefined) updates["AWS_PROFILE"] = awsProfile;
    if (analysisModel !== undefined) updates["SEAM_ANALYSIS_MODEL"] = analysisModel;
    writeEnvUpdate(updates);
    const env = readEnvFile();
    res.json({
      configured: !!env["POCKET_API_KEY"],
      pocketApiKey: env["POCKET_API_KEY"] ? maskKey(env["POCKET_API_KEY"]) : "",
      s3Bucket: env["S3_BUCKET"] || "",
      s3Prefix: env["S3_PREFIX"] || "seam/",
      awsProfile: env["AWS_PROFILE"] || "",
      analysisModel: env["SEAM_ANALYSIS_MODEL"] || "",
    });
  });

  return app;
}

let tmpDir: string;
let envFile: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `settings-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  envFile = path.join(tmpDir, ".env");
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/settings", () => {
  it("returns configured: false when .env is missing", async () => {
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.configured).toBe(false);
    expect(res.body.pocketApiKey).toBe("");
  });

  it("returns configured: true when POCKET_API_KEY exists", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_abc123xyz789\n");
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.configured).toBe(true);
  });

  it("masks the API key", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_abc123xyz789\n");
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.pocketApiKey).toBe("pk_***z789");
    expect(res.body.pocketApiKey).not.toContain("abc123");
  });

  it("returns default prefix when S3_PREFIX not set", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_test\n");
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.s3Prefix).toBe("seam/");
  });

  it("returns S3 config when set", async () => {
    writeFileSync(
      envFile,
      "POCKET_API_KEY=pk_test\nS3_BUCKET=my-bucket\nS3_PREFIX=custom/\nAWS_PROFILE=dev\n",
    );
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.s3Bucket).toBe("my-bucket");
    expect(res.body.s3Prefix).toBe("custom/");
    expect(res.body.awsProfile).toBe("dev");
  });

  it("returns empty analysisModel when not set", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_test\n");
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.analysisModel).toBe("");
  });

  it("returns analysisModel when SEAM_ANALYSIS_MODEL is set", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_test\nSEAM_ANALYSIS_MODEL=claude-sonnet-4-6\n");
    const app = createApp(envFile);
    const res = await request(app).get("/api/settings");
    expect(res.body.analysisModel).toBe("claude-sonnet-4-6");
  });
});

describe("PUT /api/settings", () => {
  it("creates .env if missing", async () => {
    const app = createApp(envFile);
    await request(app).put("/api/settings").send({ pocketApiKey: "pk_new" });
    expect(existsSync(envFile)).toBe(true);
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("POCKET_API_KEY=pk_new");
  });

  it("updates existing keys", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_old\nS3_BUCKET=old-bucket\n");
    const app = createApp(envFile);
    const res = await request(app).put("/api/settings").send({ s3Bucket: "new-bucket" });
    expect(res.body.s3Bucket).toBe("new-bucket");
    // Original key preserved
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("POCKET_API_KEY=pk_old");
    expect(content).toContain("S3_BUCKET=new-bucket");
  });

  it("preserves comments and unknown keys", async () => {
    writeFileSync(envFile, "# My config\nPOCKET_API_KEY=pk_test\nCUSTOM_VAR=hello\n");
    const app = createApp(envFile);
    await request(app).put("/api/settings").send({ s3Bucket: "my-bucket" });
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("# My config");
    expect(content).toContain("CUSTOM_VAR=hello");
    expect(content).toContain("S3_BUCKET=my-bucket");
  });

  it("returns masked key in response", async () => {
    const app = createApp(envFile);
    const res = await request(app).put("/api/settings").send({ pocketApiKey: "pk_abc123xyz789" });
    expect(res.body.pocketApiKey).toBe("pk_***z789");
    expect(res.body.configured).toBe(true);
  });

  it("adds new S3 keys when they did not exist", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_test\n");
    const app = createApp(envFile);
    await request(app)
      .put("/api/settings")
      .send({ s3Bucket: "bucket", s3Prefix: "data/", awsProfile: "prod" });
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("S3_BUCKET=bucket");
    expect(content).toContain("S3_PREFIX=data/");
    expect(content).toContain("AWS_PROFILE=prod");
  });

  it("writes SEAM_ANALYSIS_MODEL when analysisModel is set", async () => {
    const app = createApp(envFile);
    const res = await request(app)
      .put("/api/settings")
      .send({ analysisModel: "claude-haiku-4-5-20251001" });
    expect(res.body.analysisModel).toBe("claude-haiku-4-5-20251001");
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("SEAM_ANALYSIS_MODEL=claude-haiku-4-5-20251001");
  });

  it("clears SEAM_ANALYSIS_MODEL when analysisModel is empty string", async () => {
    writeFileSync(envFile, "POCKET_API_KEY=pk_test\nSEAM_ANALYSIS_MODEL=claude-opus-4-7\n");
    const app = createApp(envFile);
    const res = await request(app).put("/api/settings").send({ analysisModel: "" });
    expect(res.body.analysisModel).toBe("");
    const content = readFileSync(envFile, "utf-8");
    expect(content).toMatch(/SEAM_ANALYSIS_MODEL=\s*$/m);
  });
});
