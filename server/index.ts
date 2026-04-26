import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";

const app = express();
const PORT = 3001;
const ROOT = path.resolve(import.meta.dirname, "..");
const SYNC_FILE = path.join(ROOT, ".pocket-last-sync");
const SYNC_HISTORY_FILE = path.join(ROOT, ".seam", "sync-history.json");

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

interface SyncState {
  status: "idle" | "running" | "done" | "error" | "stopped";
  startedAt: string | null;
  finishedAt: string | null;
  lastSyncedAt: string | null;
  logs: string[];
  error: string | null;
}

const state: SyncState = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  lastSyncedAt: readLastSync(),
  logs: [],
  error: null,
};

// SSE clients listening for sync updates
const sseClients = new Set<express.Response>();

function readLastSync(): string | null {
  try {
    if (existsSync(SYNC_FILE)) {
      const content = readFileSync(SYNC_FILE, "utf-8").trim();
      return content || null;
    }
  } catch {}
  return null;
}

interface SyncHistoryEntry {
  id: string;
  status: "done" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  recordingsPulled: number;
  error: string | null;
  logs: string[];
}

function readSyncHistory(): SyncHistoryEntry[] {
  try {
    if (existsSync(SYNC_HISTORY_FILE)) {
      return JSON.parse(readFileSync(SYNC_HISTORY_FILE, "utf-8")).entries || [];
    }
  } catch {}
  return [];
}

function appendSyncHistory(entry: SyncHistoryEntry) {
  const history = readSyncHistory();
  history.unshift(entry); // newest first
  // Keep last 100 entries
  const trimmed = history.slice(0, 100);
  writeFileSync(SYNC_HISTORY_FILE, JSON.stringify({ entries: trimmed }, null, 2) + "\n");
}

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(msg);
  }
}

// Track the running sync process
let syncProc: ReturnType<typeof spawn> | null = null;

// SSE endpoint — clients connect here for real-time updates
app.get("/api/sync/stream", (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state immediately
  res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);

  sseClients.add(res);
  _req.on("close", () => sseClients.delete(res));
});

// Start a sync
app.post("/api/sync", (_req, res) => {
  if (state.status === "running") {
    res.json({ status: "already_running" });
    return;
  }

  state.status = "running";
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.logs = [];
  state.error = null;

  broadcast("status", { status: "running", startedAt: state.startedAt });

  const script = path.join(ROOT, "scripts", "pocket-run.sh");
  // Snapshot analysis dir before sync to know what's new
  const analysisBefore = new Set<string>();
  const analysisPath = path.join(ROOT, ".seam", "analysis");
  try {
    for (const d of readdirSync(analysisPath)) analysisBefore.add(d);
  } catch {}

  const proc = spawn("bash", [script], {
    cwd: ROOT,
    env: { ...process.env },
    detached: true, // create process group so we can kill the whole tree
  });
  syncProc = proc;

  function appendLog(line: string) {
    state.logs.push(line);
    broadcast("log", { line });
  }

  proc.stdout.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    lines.forEach(appendLog);
  });

  proc.stderr.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    lines.forEach((l) => appendLog(`[stderr] ${l}`));
  });

  proc.on("close", (code) => {
    syncProc = null;
    state.finishedAt = new Date().toISOString();
    state.lastSyncedAt = readLastSync();

    if (state.status === "stopped") {
      // Cancelled — clean up analyses created during this sync
      appendLog("Sync stopped. Cleaning up...");
      try {
        for (const d of readdirSync(analysisPath)) {
          if (!analysisBefore.has(d)) {
            rmSync(path.join(analysisPath, d), { recursive: true, force: true });
            appendLog(`  Removed analysis: ${d}`);
          }
        }
      } catch {}
      appendLog("Cleanup complete.");
    } else if (code === 0) {
      state.status = "done";
      appendLog("Sync completed successfully.");
    } else {
      state.status = "error";
      state.error = `Process exited with code ${code}`;
      appendLog(`Sync failed (exit code ${code}).`);
    }

    // Count recordings pulled from logs
    const pullMatch = state.logs.find((l) => l.includes("recording(s)"));
    const countMatch = pullMatch?.match(/(\d+) recording/);
    const recordingsPulled = countMatch ? parseInt(countMatch[1], 10) : 0;

    // Save to history (unless stopped)
    if (state.status !== "stopped") {
      appendSyncHistory({
        id: state.startedAt!,
        status: state.status as "done" | "error",
        startedAt: state.startedAt!,
        finishedAt: state.finishedAt,
        durationMs: new Date(state.finishedAt).getTime() - new Date(state.startedAt!).getTime(),
        recordingsPulled,
        error: state.error,
        logs: [...state.logs],
      });
    }

    broadcast("status", {
      status: state.status,
      finishedAt: state.finishedAt,
      lastSyncedAt: state.lastSyncedAt,
      error: state.error,
    });
  });

  res.json({ status: "started" });
});

// Stop a running sync — kills process and cleans up analyses created during this run
app.delete("/api/sync", (_req, res) => {
  if (state.status !== "running" || !syncProc) {
    res.json({ status: "not_running" });
    return;
  }

  state.status = "stopped";
  // status change triggers cleanup in the close handler

  // Kill the process tree
  syncProc.kill("SIGTERM");
  // Also kill any child claude processes
  try {
    process.kill(-syncProc.pid!, "SIGTERM");
  } catch {}

  broadcast("status", { status: "stopped" });
  res.json({ status: "stopped" });
});

// Get current state (non-streaming)
app.get("/api/status", (_req, res) => {
  res.json(state);
});

// Sync history
app.get("/api/sync/history", (_req, res) => {
  res.json({ entries: readSyncHistory() });
});

// ── People API ───────────────────────────────────────────────

const PEOPLE_FILE = path.join(ROOT, ".seam", "people.json");
const PENDING_PEOPLE_FILE = path.join(ROOT, ".seam", "people-pending.json");
const DISMISSED_FILE = path.join(ROOT, ".seam", "dismissed-speakers.txt");

interface Person {
  id: string;
  name: string;
  role?: string;
  notes?: string;
  aliases?: string[];
  tags?: string[];
  source: "manual" | "pocket" | "inferred";
  createdAt: string;
}

function readPeople(): Person[] {
  try {
    if (existsSync(PEOPLE_FILE)) {
      const data = JSON.parse(readFileSync(PEOPLE_FILE, "utf-8"));
      return data.people || [];
    }
  } catch {}
  return [];
}

function writePeople(people: Person[]) {
  writeFileSync(PEOPLE_FILE, JSON.stringify({ people }, null, 2) + "\n");
}

app.get("/api/people", (_req, res) => {
  res.json({ people: readPeople() });
});

app.post("/api/people", (req, res) => {
  const { name, role, notes } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const people = readPeople();
  // Don't add duplicates (case-insensitive)
  if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    res.status(409).json({ error: "Person already exists" });
    return;
  }
  const { aliases, tags: personTags } = req.body;
  const person: Person = {
    id: randomUUID(),
    name: name.trim(),
    role: role?.trim() || undefined,
    notes: notes?.trim() || undefined,
    aliases: Array.isArray(aliases)
      ? aliases.map((a: string) => a.trim()).filter(Boolean)
      : undefined,
    tags: Array.isArray(personTags)
      ? personTags.map((t: string) => t.trim()).filter(Boolean)
      : undefined,
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  people.push(person);
  writePeople(people);
  res.status(201).json(person);
});

app.put("/api/people/:id", (req, res) => {
  const people = readPeople();
  const idx = people.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { name, role, notes, aliases } = req.body;
  if (name) people[idx].name = name.trim();
  if (role !== undefined) people[idx].role = role?.trim() || undefined;
  if (notes !== undefined) people[idx].notes = notes?.trim() || undefined;
  if (aliases !== undefined)
    people[idx].aliases = Array.isArray(aliases)
      ? aliases.map((a: string) => a.trim()).filter(Boolean)
      : undefined;
  const { tags: personTags } = req.body;
  if (personTags !== undefined)
    people[idx].tags = Array.isArray(personTags)
      ? personTags.map((t: string) => t.trim()).filter(Boolean)
      : undefined;
  writePeople(people);
  res.json(people[idx]);
});

app.delete("/api/people/:id", (req, res) => {
  const people = readPeople();
  const filtered = people.filter((p) => p.id !== req.params.id);
  if (filtered.length === people.length) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  writePeople(filtered);
  res.json({ ok: true });
});

// ── Pending People (staging) ─────────────────────────────────

interface PendingPerson {
  id: string;
  name: string;
  seenIn: string[];
  count: number;
  suggestedMatch: string | null;
  createdAt: string;
}

function readPending(): PendingPerson[] {
  try {
    if (existsSync(PENDING_PEOPLE_FILE)) {
      return JSON.parse(readFileSync(PENDING_PEOPLE_FILE, "utf-8")).pending || [];
    }
  } catch {}
  return [];
}

function writePending(pending: PendingPerson[]) {
  writeFileSync(PENDING_PEOPLE_FILE, JSON.stringify({ pending }, null, 2) + "\n");
}

function addDismissed(name: string) {
  const existing = existsSync(DISMISSED_FILE) ? readFileSync(DISMISSED_FILE, "utf-8") : "";
  const names = new Set(existing.trim().split("\n").filter(Boolean));
  names.add(name.toLowerCase());
  writeFileSync(DISMISSED_FILE, [...names].join("\n") + "\n");
}

// List pending speakers
app.get("/api/people/pending", (_req, res) => {
  res.json({ pending: readPending() });
});

// Confirm — move from pending to people.json as a new person
app.post("/api/people/pending/:id/confirm", (_req, res) => {
  const pending = readPending();
  const idx = pending.findIndex((p) => p.id === _req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const entry = pending[idx];
  const people = readPeople();
  const person: Person = {
    id: randomUUID(),
    name: entry.name,
    source: "inferred",
    createdAt: new Date().toISOString(),
  };
  people.push(person);
  writePeople(people);
  pending.splice(idx, 1);
  writePending(pending);
  res.json(person);
});

// Merge — add as alias to an existing person, remove from pending
app.post("/api/people/pending/:id/merge", (req, res) => {
  const { targetPersonId } = req.body as { targetPersonId: string };
  if (!targetPersonId) {
    res.status(400).json({ error: "targetPersonId required" });
    return;
  }
  const pending = readPending();
  const idx = pending.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Pending person not found" });
    return;
  }
  const entry = pending[idx];
  const people = readPeople();
  const target = people.find((p) => p.id === targetPersonId);
  if (!target) {
    res.status(404).json({ error: "Target person not found" });
    return;
  }
  // Add as alias
  if (!target.aliases) target.aliases = [];
  if (!target.aliases.some((a) => a.toLowerCase() === entry.name.toLowerCase())) {
    target.aliases.push(entry.name);
  }
  writePeople(people);
  pending.splice(idx, 1);
  writePending(pending);
  res.json(target);
});

// Dismiss — remove from pending, add to exclusion list
app.post("/api/people/pending/:id/dismiss", (req, res) => {
  const pending = readPending();
  const idx = pending.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const entry = pending[idx];
  addDismissed(entry.name);
  pending.splice(idx, 1);
  writePending(pending);
  res.json({ ok: true });
});

// Delete a recording (and its analysis), track it so sync doesn't re-pull
const DELETED_FILE = path.join(ROOT, ".seam", ".deleted");

function readDeleted(): Set<string> {
  try {
    if (existsSync(DELETED_FILE)) {
      return new Set(readFileSync(DELETED_FILE, "utf-8").trim().split("\n").filter(Boolean));
    }
  } catch {}
  return new Set();
}

function addDeleted(dirName: string) {
  const deleted = readDeleted();
  deleted.add(dirName);
  writeFileSync(DELETED_FILE, [...deleted].join("\n") + "\n");
}

app.delete("/api/recordings/:dirName", (req, res) => {
  const { dirName } = req.params;
  const recDir = path.join(ROOT, ".seam", "recordings", dirName);
  const analysisDir = path.join(ROOT, ".seam", "analysis", dirName);

  if (!existsSync(recDir)) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }

  try {
    rmSync(recDir, { recursive: true, force: true });
    if (existsSync(analysisDir)) {
      rmSync(analysisDir, { recursive: true, force: true });
    }
    addDeleted(dirName);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }

  // Rebuild manifest
  const buildScript = path.join(ROOT, "scripts", "build-manifest.py");
  spawn("python3", [buildScript], { cwd: ROOT });

  res.json({ ok: true });
});

// Toggle action item completion
app.put("/api/recordings/:dirName/actions/:index", (req, res) => {
  const { dirName, index } = req.params;
  const { completed } = req.body as { completed: boolean };

  const analysisFile = path.join(ROOT, ".seam", "analysis", dirName, "analysis.json");
  if (!existsSync(analysisFile)) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const data = JSON.parse(readFileSync(analysisFile, "utf-8"));
  const i = parseInt(index, 10);
  if (data.action_items?.[i]) {
    data.action_items[i].completed = completed;
    writeFileSync(analysisFile, JSON.stringify(data, null, 2));

    // Rebuild manifest
    const buildScript = path.join(ROOT, "scripts", "build-manifest.py");
    spawn("python3", [buildScript], { cwd: ROOT });

    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "Action item not found" });
  }
});

// Update speaker assignment on a recording's transcript
app.put("/api/recordings/:dirName/speakers", (req, res) => {
  const { dirName } = req.params;
  const { assignments } = req.body as { assignments: Record<number, string> };
  // assignments is { segmentIndex: speakerName }

  const recFile = path.join(ROOT, ".seam", "recordings", dirName, "recording.json");
  if (!existsSync(recFile)) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }

  const data = JSON.parse(readFileSync(recFile, "utf-8"));
  for (const [idx, speaker] of Object.entries(assignments)) {
    const i = parseInt(idx, 10);
    if (data.transcript?.[i]) {
      data.transcript[i].speaker = speaker;
    }
  }
  writeFileSync(recFile, JSON.stringify(data, null, 2));

  // Rebuild manifest
  const buildScript = path.join(ROOT, "scripts", "build-manifest.py");
  spawn("python3", [buildScript], { cwd: ROOT });

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Seam API running on http://localhost:${PORT}`);
});
