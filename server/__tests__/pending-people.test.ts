import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, existsSync, unlinkSync, readFileSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";

function createApp(dataDir: string) {
  const app = express();
  app.use(express.json());

  const PEOPLE_FILE = path.join(dataDir, "people.json");
  const PENDING_FILE = path.join(dataDir, "people-pending.json");
  const DISMISSED_FILE = path.join(dataDir, "dismissed-speakers.txt");

  interface Person {
    id: string;
    name: string;
    aliases?: string[];
    source: string;
    createdAt: string;
  }

  interface PendingPerson {
    id: string;
    name: string;
    seenIn: string[];
    count: number;
    suggestedMatch: string | null;
    createdAt: string;
  }

  function readPeople(): Person[] {
    try {
      if (existsSync(PEOPLE_FILE)) {
        return JSON.parse(readFileSync(PEOPLE_FILE, "utf-8")).people || [];
      }
    } catch {}
    return [];
  }

  function writePeople(people: Person[]) {
    writeFileSync(PEOPLE_FILE, JSON.stringify({ people }, null, 2) + "\n");
  }

  function readPending(): PendingPerson[] {
    try {
      if (existsSync(PENDING_FILE)) {
        return JSON.parse(readFileSync(PENDING_FILE, "utf-8")).pending || [];
      }
    } catch {}
    return [];
  }

  function writePending(pending: PendingPerson[]) {
    if (pending.length === 0) {
      try {
        if (existsSync(PENDING_FILE)) unlinkSync(PENDING_FILE);
      } catch {}
      return;
    }
    writeFileSync(PENDING_FILE, JSON.stringify({ pending }, null, 2) + "\n");
  }

  function addDismissed(name: string) {
    const existing = existsSync(DISMISSED_FILE) ? readFileSync(DISMISSED_FILE, "utf-8") : "";
    const names = new Set(existing.trim().split("\n").filter(Boolean));
    names.add(name.toLowerCase());
    writeFileSync(DISMISSED_FILE, [...names].join("\n") + "\n");
  }

  app.get("/api/people/pending", (_req, res) => {
    res.json({ pending: readPending() });
  });

  app.post("/api/people/pending/:id/confirm", (req, res) => {
    const pending = readPending();
    const idx = pending.findIndex((p) => p.id === req.params.id);
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

  app.post("/api/people/pending/:id/merge", (req, res) => {
    const { targetPersonId } = req.body;
    if (!targetPersonId) {
      res.status(400).json({ error: "targetPersonId required" });
      return;
    }
    const pending = readPending();
    const idx = pending.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Pending not found" });
      return;
    }
    const entry = pending[idx];
    const people = readPeople();
    const target = people.find((p) => p.id === targetPersonId);
    if (!target) {
      res.status(404).json({ error: "Target not found" });
      return;
    }
    if (!target.aliases) target.aliases = [];
    if (!target.aliases.some((a) => a.toLowerCase() === entry.name.toLowerCase())) {
      target.aliases.push(entry.name);
    }
    writePeople(people);
    pending.splice(idx, 1);
    writePending(pending);
    res.json(target);
  });

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

  return app;
}

describe("Pending People API", () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;

  const seedPending = (entries: Array<{ id: string; name: string }>) => {
    const pending = entries.map((e) => ({
      ...e,
      seenIn: ["rec_001"],
      count: 3,
      suggestedMatch: null,
      createdAt: new Date().toISOString(),
    }));
    writeFileSync(path.join(tmpDir, "people-pending.json"), JSON.stringify({ pending }));
  };

  const seedPeople = (people: Array<{ id: string; name: string }>) => {
    const full = people.map((p) => ({
      ...p,
      source: "manual",
      createdAt: new Date().toISOString(),
    }));
    writeFileSync(path.join(tmpDir, "people.json"), JSON.stringify({ people: full }));
  };

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `seam-test-pending-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(path.join(tmpDir, "people.json"), JSON.stringify({ people: [] }));
    app = createApp(tmpDir);
  });

  afterEach(() => {
    const { rmSync } = require("fs");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/people/pending returns empty when no file", async () => {
    const res = await request(app).get("/api/people/pending");
    expect(res.status).toBe(200);
    expect(res.body.pending).toEqual([]);
  });

  it("GET /api/people/pending returns staged entries", async () => {
    seedPending([{ id: "p1", name: "Ethan" }]);
    const res = await request(app).get("/api/people/pending");
    expect(res.body.pending).toHaveLength(1);
    expect(res.body.pending[0].name).toBe("Ethan");
  });

  it("POST confirm moves pending to people.json", async () => {
    seedPending([{ id: "p1", name: "Ethan" }]);
    const res = await request(app).post("/api/people/pending/p1/confirm");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Ethan");
    expect(res.body.source).toBe("inferred");

    // Pending should be empty
    const pending = await request(app).get("/api/people/pending");
    expect(pending.body.pending).toHaveLength(0);

    // People should have Ethan
    const people = JSON.parse(readFileSync(path.join(tmpDir, "people.json"), "utf-8"));
    expect(people.people).toHaveLength(1);
    expect(people.people[0].name).toBe("Ethan");
  });

  it("POST confirm returns 404 for unknown id", async () => {
    const res = await request(app).post("/api/people/pending/nope/confirm");
    expect(res.status).toBe(404);
  });

  it("POST merge adds as alias to target person", async () => {
    seedPeople([{ id: "person1", name: "Ethan Johnson" }]);
    seedPending([{ id: "p1", name: "Ethan" }]);

    const res = await request(app)
      .post("/api/people/pending/p1/merge")
      .send({ targetPersonId: "person1" });
    expect(res.status).toBe(200);
    expect(res.body.aliases).toContain("Ethan");

    // Pending should be empty
    const pending = await request(app).get("/api/people/pending");
    expect(pending.body.pending).toHaveLength(0);
  });

  it("POST merge returns 400 without targetPersonId", async () => {
    seedPending([{ id: "p1", name: "Ethan" }]);
    const res = await request(app).post("/api/people/pending/p1/merge").send({});
    expect(res.status).toBe(400);
  });

  it("POST merge returns 404 for unknown target", async () => {
    seedPending([{ id: "p1", name: "Ethan" }]);
    const res = await request(app)
      .post("/api/people/pending/p1/merge")
      .send({ targetPersonId: "nope" });
    expect(res.status).toBe(404);
  });

  it("POST merge doesn't duplicate aliases", async () => {
    seedPeople([{ id: "person1", name: "Ethan Johnson" }]);
    // Manually add the alias first
    const pf = path.join(tmpDir, "people.json");
    const data = JSON.parse(readFileSync(pf, "utf-8"));
    data.people[0].aliases = ["Ethan"];
    writeFileSync(pf, JSON.stringify(data));

    seedPending([{ id: "p1", name: "Ethan" }]);
    const res = await request(app)
      .post("/api/people/pending/p1/merge")
      .send({ targetPersonId: "person1" });
    expect(res.body.aliases).toEqual(["Ethan"]); // not duplicated
  });

  it("POST dismiss removes from pending and adds to exclusion list", async () => {
    seedPending([{ id: "p1", name: "Manager" }]);
    const res = await request(app).post("/api/people/pending/p1/dismiss");
    expect(res.status).toBe(200);

    // Pending should be empty
    const pending = await request(app).get("/api/people/pending");
    expect(pending.body.pending).toHaveLength(0);

    // Dismissed file should contain the name
    const dismissed = readFileSync(path.join(tmpDir, "dismissed-speakers.txt"), "utf-8");
    expect(dismissed).toContain("manager");
  });

  it("POST dismiss returns 404 for unknown id", async () => {
    const res = await request(app).post("/api/people/pending/nope/dismiss");
    expect(res.status).toBe(404);
  });

  it("cleans up pending file when last entry is removed", async () => {
    seedPending([{ id: "p1", name: "Ethan" }]);
    await request(app).post("/api/people/pending/p1/confirm");
    expect(existsSync(path.join(tmpDir, "people-pending.json"))).toBe(false);
  });
});
