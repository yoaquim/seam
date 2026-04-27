import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";

export interface S3Config {
  bucket: string;
  prefix: string;
  awsProfile?: string;
}

const EXCLUDE = new Set(["seam.log"]);

export class S3Sync {
  private client: S3Client | null = null;
  private config: S3Config | null = null;
  private syncing = false;
  private pendingFiles = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private seamDir: string;

  constructor(private root: string) {
    this.seamDir = path.join(root, ".seam");
  }

  get isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /** Read S3 config from .env and create client. Returns true if configured. */
  configure(): boolean {
    const env = this.readEnv();
    const bucket = env["S3_BUCKET"];
    if (!bucket) {
      this.client = null;
      this.config = null;
      return false;
    }

    const prefix = env["S3_PREFIX"] || "seam/";
    const awsProfile = env["AWS_PROFILE"] || undefined;

    this.config = { bucket, prefix: prefix.endsWith("/") ? prefix : prefix + "/", awsProfile };
    this.client = new S3Client(awsProfile ? { profile: awsProfile } : {});
    return true;
  }

  /** Queue files for debounced upload. Paths are relative to .seam/ */
  syncFiles(...relativePaths: string[]): void {
    if (!this.isConfigured) return;
    for (const p of relativePaths) this.pendingFiles.add(p);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushPending(), 300);
  }

  /** Delete all objects under a prefix relative to .seam/ */
  async deletePrefix(relativePrefix: string): Promise<void> {
    if (!this.isConfigured) return;
    const fullPrefix = this.config!.prefix + relativePrefix;
    try {
      const listed = await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.config!.bucket,
          Prefix: fullPrefix,
        }),
      );
      const keys = (listed.Contents || []).map((o) => o.Key!).filter(Boolean);
      if (keys.length === 0) return;
      await this.client!.send(
        new DeleteObjectsCommand({
          Bucket: this.config!.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    } catch (err) {
      console.warn("S3 deletePrefix failed:", err);
    }
  }

  /** Upload all files in .seam/ to S3 (excluding EXCLUDE list). */
  async fullSync(): Promise<void> {
    if (!this.isConfigured) return;
    if (this.syncing) return;
    this.syncing = true;
    try {
      const files = this.walkDir(this.seamDir);
      const results = await Promise.allSettled(files.map((rel) => this.uploadFile(rel)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) console.warn(`S3 fullSync: ${failed}/${files.length} uploads failed`);
    } catch (err) {
      console.warn("S3 fullSync failed:", err);
    } finally {
      this.syncing = false;
    }
  }

  /** Test S3 connection by listing one object. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured) return { ok: false, error: "S3 is not configured" };
    try {
      await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.config!.bucket,
          MaxKeys: 1,
        }),
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /** Upload a single file. Path is relative to .seam/ */
  async uploadFile(relativePath: string): Promise<void> {
    if (!this.isConfigured) return;
    const localPath = path.join(this.seamDir, relativePath);
    if (!existsSync(localPath)) return;
    const key = this.config!.prefix + relativePath;
    try {
      const body = readFileSync(localPath);
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.config!.bucket,
          Key: key,
          Body: body,
        }),
      );
    } catch (err) {
      console.warn(`S3 upload failed for ${relativePath}:`, err);
    }
  }

  private async flushPending(): Promise<void> {
    const files = [...this.pendingFiles];
    this.pendingFiles.clear();
    this.debounceTimer = null;
    await Promise.allSettled(files.map((f) => this.uploadFile(f)));
  }

  private walkDir(dir: string, base: string = ""): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;
    for (const entry of readdirSync(dir)) {
      if (EXCLUDE.has(entry)) continue;
      const full = path.join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...this.walkDir(full, rel));
      } else {
        results.push(rel);
      }
    }
    return results;
  }

  private readEnv(): Record<string, string> {
    const envPath = path.join(this.root, ".env");
    const result: Record<string, string> = {};
    if (!existsSync(envPath)) return result;
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
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
}
