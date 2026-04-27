import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";
import os from "os";

// Mock the AWS SDK before importing S3Sync
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(function (this: { send: typeof mockSend }) {
      this.send = mockSend;
    }),
    PutObjectCommand: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      input: Record<string, unknown>,
    ) {
      Object.assign(this, input);
    }),
    DeleteObjectCommand: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      input: Record<string, unknown>,
    ) {
      Object.assign(this, input);
    }),
    DeleteObjectsCommand: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      input: Record<string, unknown>,
    ) {
      Object.assign(this, input);
    }),
    ListObjectsV2Command: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      input: Record<string, unknown>,
    ) {
      Object.assign(this, input);
    }),
  };
});

import { S3Sync } from "../s3.js";

let tmpDir: string;
let seamDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `s3-test-${Date.now()}`);
  seamDir = path.join(tmpDir, ".seam");
  mkdirSync(seamDir, { recursive: true });
  mockSend.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("S3Sync", () => {
  describe("configure", () => {
    it("returns false when S3_BUCKET not in .env", () => {
      writeFileSync(path.join(tmpDir, ".env"), "POCKET_API_KEY=pk_test\n");
      const s3 = new S3Sync(tmpDir);
      expect(s3.configure()).toBe(false);
      expect(s3.isConfigured).toBe(false);
    });

    it("returns true and creates client when S3_BUCKET is set", () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      expect(s3.configure()).toBe(true);
      expect(s3.isConfigured).toBe(true);
    });

    it("uses default prefix when S3_PREFIX not set", () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      // Verify by uploading a file and checking the key
      writeFileSync(path.join(seamDir, "test.json"), "{}");
      mockSend.mockResolvedValueOnce({});
      return s3.uploadFile("test.json").then(() => {
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ Key: "seam/test.json" }));
      });
    });

    it("uses custom prefix from .env", () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=b\nS3_PREFIX=custom/\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      writeFileSync(path.join(seamDir, "test.json"), "{}");
      mockSend.mockResolvedValueOnce({});
      return s3.uploadFile("test.json").then(() => {
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ Key: "custom/test.json" }));
      });
    });

    it("adds trailing slash to prefix if missing", () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=b\nS3_PREFIX=noslash\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      writeFileSync(path.join(seamDir, "test.json"), "{}");
      mockSend.mockResolvedValueOnce({});
      return s3.uploadFile("test.json").then(() => {
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({ Key: "noslash/test.json" }),
        );
      });
    });

    it("returns false when .env does not exist", () => {
      const s3 = new S3Sync(tmpDir);
      expect(s3.configure()).toBe(false);
    });
  });

  describe("uploadFile", () => {
    it("is no-op when not configured", async () => {
      const s3 = new S3Sync(tmpDir);
      await s3.uploadFile("people.json");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("uploads file with correct bucket and key", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "people.json"), '{"people":[]}');
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValueOnce({});
      await s3.uploadFile("people.json");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "my-bucket",
          Key: "seam/people.json",
        }),
      );
    });

    it("skips if local file does not exist", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      await s3.uploadFile("nonexistent.json");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("logs warning on upload error but does not throw", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "test.json"), "{}");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockRejectedValueOnce(new Error("Access Denied"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await s3.uploadFile("test.json");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("S3 upload failed"),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe("deletePrefix", () => {
    it("is no-op when not configured", async () => {
      const s3 = new S3Sync(tmpDir);
      await s3.deletePrefix("recordings/2026-01-01_test");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("lists then deletes all objects under prefix", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend
        .mockResolvedValueOnce({
          Contents: [
            { Key: "seam/recordings/test/recording.json" },
            { Key: "seam/recordings/test/recording.md" },
          ],
        })
        .mockResolvedValueOnce({});
      await s3.deletePrefix("recordings/test");
      expect(mockSend).toHaveBeenCalledTimes(2);
      // First call: ListObjectsV2
      expect(mockSend.mock.calls[0][0]).toEqual(
        expect.objectContaining({ Prefix: "seam/recordings/test" }),
      );
      // Second call: DeleteObjects
      expect(mockSend.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          Delete: {
            Objects: [
              { Key: "seam/recordings/test/recording.json" },
              { Key: "seam/recordings/test/recording.md" },
            ],
          },
        }),
      );
    });

    it("does nothing when no objects found", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValueOnce({ Contents: [] });
      await s3.deletePrefix("recordings/empty");
      expect(mockSend).toHaveBeenCalledTimes(1); // Only the list call
    });
  });

  describe("fullSync", () => {
    it("is no-op when not configured", async () => {
      const s3 = new S3Sync(tmpDir);
      await s3.fullSync();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("uploads all files in .seam/ recursively", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "people.json"), "{}");
      const recDir = path.join(seamDir, "recordings", "2026-01-01_test");
      mkdirSync(recDir, { recursive: true });
      writeFileSync(path.join(recDir, "recording.json"), "{}");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValue({});
      await s3.fullSync();
      expect(mockSend).toHaveBeenCalledTimes(2);
      const keys = mockSend.mock.calls.map((c: unknown[]) => (c[0] as { Key: string }).Key).sort();
      expect(keys).toEqual(["seam/people.json", "seam/recordings/2026-01-01_test/recording.json"]);
    });

    it("excludes seam.log", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "people.json"), "{}");
      writeFileSync(path.join(seamDir, "seam.log"), "log line\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValue({});
      await s3.fullSync();
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0]).toEqual(
        expect.objectContaining({ Key: "seam/people.json" }),
      );
    });

    it("prevents concurrent fullSync calls", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "people.json"), "{}");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      // First call takes a while
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((r) => (resolveFirst = r));
      mockSend.mockImplementationOnce(() => firstPromise.then(() => ({})));
      const sync1 = s3.fullSync();
      const sync2 = s3.fullSync(); // Should be skipped
      resolveFirst!();
      await sync1;
      await sync2;
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("testConnection", () => {
    it("returns error when not configured", async () => {
      const s3 = new S3Sync(tmpDir);
      const result = await s3.testConnection();
      expect(result).toEqual({ ok: false, error: "S3 is not configured" });
    });

    it("returns ok on success", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValueOnce({});
      const result = await s3.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it("returns error on failure", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockRejectedValueOnce(new Error("NoSuchBucket"));
      const result = await s3.testConnection();
      expect(result.ok).toBe(false);
      expect(result.error).toContain("NoSuchBucket");
    });
  });

  describe("syncFiles (debounce)", () => {
    it("batches multiple calls within 300ms", async () => {
      writeFileSync(path.join(tmpDir, ".env"), "S3_BUCKET=my-bucket\n");
      writeFileSync(path.join(seamDir, "people.json"), "{}");
      writeFileSync(path.join(seamDir, "people-pending.json"), "{}");
      const s3 = new S3Sync(tmpDir);
      s3.configure();
      mockSend.mockResolvedValue({});

      s3.syncFiles("people.json");
      s3.syncFiles("people-pending.json");
      s3.syncFiles("people.json"); // duplicate, should be deduped

      // Nothing uploaded yet
      expect(mockSend).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(300);

      // Should upload 2 unique files
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("is no-op when not configured", async () => {
      const s3 = new S3Sync(tmpDir);
      s3.syncFiles("people.json");
      await vi.advanceTimersByTimeAsync(300);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
